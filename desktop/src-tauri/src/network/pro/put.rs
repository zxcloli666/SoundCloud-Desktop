use std::ops::Range;
use std::time::Duration;

use http::Version;
use tokio::sync::watch;

use super::open::{self, Opened, Unopened};
use super::stage::{self, Failed, Stage, bytes_in};
use super::{Asked, STAGED_OVER, client};

const FIRST_PART: u64 = 32 * 1024;
const LAST_PART: u64 = 4 * 1024;
const GROW_AFTER: u32 = 4;
const STALLS: usize = 6;
const SENT_BUDGET: u64 = 4;
const OPENS: usize = 3;
const OPEN_PAUSE: Duration = Duration::from_secs(1);
const CLOSE_TIMEOUT: Duration = Duration::from_secs(5);
const INCOMPLETE: u16 = 409;
const BUSY: [u16; 2] = [429, 503];
const TAKEN: [u16; 3] = [404, 502, 504];

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Staging {
    pub stage: Option<String>,
    pub sent: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StagedFailure {
    Link(String),
    Gone(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Filled {
    Stage(String),
    Inline,
}

pub async fn fill_stage(
    node: &str,
    body: &[u8],
    resume: Option<&str>,
    progress: &watch::Sender<Staging>,
) -> Result<Filled, StagedFailure> {
    if body.len() <= STAGED_OVER {
        return Ok(Filled::Inline);
    }
    let client = client().ok_or_else(|| link("pro: http client is unavailable"))?;
    match resume {
        Some(id) => restored(client, node, id, body, progress).await,
        None => staged_anew(client, node, body, progress).await,
    }
}

pub async fn open_filled(
    node: &str,
    asked: &Asked,
    body: &[u8],
    filled: &Filled,
    progress: &watch::Sender<Staging>,
) -> Result<u16, StagedFailure> {
    let client = client().ok_or_else(|| link("pro: http client is unavailable"))?;
    let mut filled = filled.clone();
    let mut last = String::new();
    for attempt in 0..OPENS {
        let Filled::Stage(id) = filled.clone() else {
            return inline(client, node, asked, body).await;
        };
        let refused = match open::staged(client, node, asked, &id).await {
            Ok(opened) => return Ok(answered(client, node, opened)),
            Err(Unopened::Refused(status)) => status,
            Err(unopened) => {
                last = unopened.explained();
                filled = restored(client, node, &id, body, progress).await?;
                continue;
            }
        };
        last = format!("pro: open answered {refused}");
        if refused == INCOMPLETE {
            last = "pro: the stage stayed incomplete".to_string();
            filled = restored(client, node, &id, body, progress).await?;
        } else if TAKEN.contains(&refused) {
            filled = restored(client, node, &id, body, progress).await?;
        } else if BUSY.contains(&refused) {
            if attempt + 1 < OPENS {
                tokio::time::sleep(OPEN_PAUSE * (attempt as u32 + 1)).await;
            }
        } else {
            return Err(link(last));
        }
    }
    Err(link(last))
}

async fn restored(
    client: &'static wreq::Client,
    node: &str,
    id: &str,
    body: &[u8],
    progress: &watch::Sender<Staging>,
) -> Result<Filled, StagedFailure> {
    let refilled = match stage::reopen(client, node, id, body.len() as u64).await {
        Ok((stage, missing)) => fill(&stage, body, missing, progress).await,
        Err(failed) => Err(staged_failure(failed)),
    };
    match refilled {
        Ok(()) => Ok(Filled::Stage(id.to_string())),
        Err(StagedFailure::Gone(_)) => staged_anew(client, node, body, progress).await,
        Err(failure) => Err(failure),
    }
}

async fn staged_anew(
    client: &'static wreq::Client,
    node: &str,
    body: &[u8],
    progress: &watch::Sender<Staging>,
) -> Result<Filled, StagedFailure> {
    let created = stage::create(client, node, body.len() as u64)
        .await
        .map_err(link)?;
    let Some((stage, missing)) = created else {
        return Ok(Filled::Inline);
    };
    fill(&stage, body, missing, progress).await?;
    Ok(Filled::Stage(stage.id))
}

async fn fill(
    stage: &Stage,
    body: &[u8],
    mut missing: Vec<Range<u64>>,
    progress: &watch::Sender<Staging>,
) -> Result<(), StagedFailure> {
    let size = body.len() as u64;
    let budget = size.max(FIRST_PART) * SENT_BUDGET;
    let mut part = FIRST_PART;
    let (mut sent, mut streak, mut stalls) = (0, 0, 0);
    let mut checked = bytes_in(&missing);
    report(progress, stage, size, &missing);
    while let Some(hole) = missing.first().cloned() {
        if sent >= budget {
            return Err(link("pro: the stage keeps losing parts"));
        }
        let next = hole.start..(hole.start + part).min(hole.end);
        sent += next.end - next.start;
        match stage.put(body, next.clone()).await {
            Ok(()) => {
                taken(&mut missing, next.end);
                streak += 1;
                if streak >= GROW_AFTER {
                    part = (part * 2).min(FIRST_PART);
                    streak = 0;
                }
            }
            Err(Failed::Gone(why)) => return Err(StagedFailure::Gone(why)),
            Err(Failed::Link(why)) => {
                part = (part / 2).max(LAST_PART);
                streak = 0;
                missing = stage.missing().await.map_err(staged_failure)?;
                let left = bytes_in(&missing);
                stalls = if left < checked { 0 } else { stalls + 1 };
                checked = left;
                if stalls >= STALLS {
                    return Err(link(why));
                }
            }
        }
        report(progress, stage, size, &missing);
    }
    Ok(())
}

fn taken(missing: &mut Vec<Range<u64>>, end: u64) {
    if let Some(first) = missing.first_mut() {
        first.start = end;
        if first.start >= first.end {
            missing.remove(0);
        }
    }
}

fn report(progress: &watch::Sender<Staging>, stage: &Stage, size: u64, missing: &[Range<u64>]) {
    let sent = size - bytes_in(missing).min(size);
    progress.send_modify(|staging| {
        let same = staging.stage.as_deref() == Some(stage.id.as_str());
        staging.sent = if same { staging.sent.max(sent) } else { sent };
        staging.stage = Some(stage.id.clone());
    });
}

async fn inline(
    client: &'static wreq::Client,
    node: &str,
    asked: &Asked,
    body: &[u8],
) -> Result<u16, StagedFailure> {
    let carried = Asked {
        body: Some(body.to_vec()),
        ..asked.clone()
    };
    let opened = open::plain(client, node, &carried)
        .await
        .map_err(|unopened| link(unopened.explained()))?;
    Ok(answered(client, node, opened))
}

fn answered(client: &'static wreq::Client, node: &str, opened: Opened) -> u16 {
    let answer = format!("{node}/take/{}", opened.id);
    tokio::spawn(async move {
        client
            .delete(answer)
            .version(Version::HTTP_11)
            .timeout(CLOSE_TIMEOUT)
            .send()
            .await
            .ok();
    });
    opened.status
}

fn staged_failure(failed: Failed) -> StagedFailure {
    match failed {
        Failed::Link(why) => StagedFailure::Link(why),
        Failed::Gone(why) => StagedFailure::Gone(why),
    }
}

fn link(why: impl Into<String>) -> StagedFailure {
    StagedFailure::Link(why.into())
}

use std::ops::Range;

use futures_util::StreamExt;
use tokio::sync::watch;

use super::open::{self, Opened, Unopened};
use super::stage::{self, Failed, Stage};
use super::{Asked, client, pieces};

const FIRST_PART: u64 = 32 * 1024;
const LAST_PART: u64 = 4 * 1024;
const STALLS: usize = 6;
const OPENS: usize = 3;
const INCOMPLETE: u16 = 409;
const GONE: u16 = 404;

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
    let client = client().ok_or_else(|| link("pro: http client is unavailable"))?;
    let size = body.len() as u64;
    let reopened = match resume {
        Some(id) => stage::reopen(client, node, id, size).await.map_err(link)?,
        None => None,
    };
    let (stage, missing) = match reopened {
        Some(found) => found,
        None => match stage::create(client, node, size).await.map_err(link)? {
            Some(created) => created,
            None => return Ok(Filled::Inline),
        },
    };
    fill(&stage, body, missing, progress).await?;
    Ok(Filled::Stage(stage.id))
}

pub async fn open_filled(
    node: &str,
    asked: &Asked,
    body: &[u8],
    filled: &Filled,
    progress: &watch::Sender<Staging>,
) -> Result<u16, StagedFailure> {
    let client = client().ok_or_else(|| link("pro: http client is unavailable"))?;
    let Filled::Stage(id) = filled else {
        return plain(client, node, asked, body).await;
    };
    let mut last = String::new();
    for _ in 0..OPENS {
        match open::staged(client, node, asked, id).await {
            Ok(opened) => return Ok(answered(client, node, opened).await),
            Err(Unopened::Refused(INCOMPLETE)) => refill(client, node, id, body, progress).await?,
            Err(Unopened::Refused(GONE)) => return Err(gone()),
            Err(unopened) => last = unopened.explained(),
        }
    }
    Err(link(last))
}

async fn refill(
    client: &'static wreq::Client,
    node: &str,
    id: &str,
    body: &[u8],
    progress: &watch::Sender<Staging>,
) -> Result<(), StagedFailure> {
    match stage::reopen(client, node, id, body.len() as u64)
        .await
        .map_err(link)?
    {
        Some((stage, missing)) => fill(&stage, body, missing, progress).await,
        None => Err(gone()),
    }
}

fn gone() -> StagedFailure {
    StagedFailure::Gone("pro: the stage is gone".into())
}

async fn fill(
    stage: &Stage,
    body: &[u8],
    mut missing: Vec<Range<u64>>,
    progress: &watch::Sender<Staging>,
) -> Result<(), StagedFailure> {
    let size = body.len() as u64;
    let mut part = FIRST_PART;
    let mut stalls = 0;
    report(progress, stage, size, &missing);
    while let Some(hole) = missing.first().cloned() {
        let next = hole.start..(hole.start + part).min(hole.end);
        match stage.put(body, next.clone()).await {
            Ok(()) => {
                stalls = 0;
                taken(&mut missing, next.end);
                report(progress, stage, size, &missing);
            }
            Err(Failed::Gone(why)) => return Err(StagedFailure::Gone(why)),
            Err(Failed::Link(why)) => {
                stalls += 1;
                if stalls >= STALLS {
                    return Err(StagedFailure::Link(why));
                }
                part = (part / 2).max(LAST_PART);
                missing = stage.missing().await.map_err(StagedFailure::Gone)?;
                report(progress, stage, size, &missing);
            }
        }
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
    let left: u64 = missing.iter().map(|hole| hole.end - hole.start).sum();
    progress.send_replace(Staging {
        stage: Some(stage.id.clone()),
        sent: size - left.min(size),
    });
}

async fn plain(
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
        .map_err(|unopened| link(&unopened.explained()))?;
    Ok(answered(client, node, opened).await)
}

async fn answered(client: &'static wreq::Client, node: &str, opened: Opened) -> u16 {
    let mut body = pieces::stream(client, format!("{node}/take/{}", opened.id), None);
    while let Some(piece) = body.next().await {
        if piece.is_err() {
            break;
        }
    }
    opened.status
}

fn link(why: impl Into<String>) -> StagedFailure {
    StagedFailure::Link(why.into())
}

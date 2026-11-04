use std::sync::OnceLock;
use std::time::Duration;

use bytes::Bytes;
use sc_chat::api::wire::PresignedPut;
use sc_chat::store::MediaUpload;
use sc_chat::{ChatError, Millis, UploadObject};
use tokio::sync::watch;

use super::engine::Uploads;
use super::errors::Snag;
use crate::app::diagnostics;
use crate::network::edge::{Hop, Tier};
use crate::network::pro::{Asked, StagedFailure, Staging, fill_stage, open_filled};
use crate::network::system_proxy;

pub const UNIT: u64 = 32 * 1024;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const PUT_TIMEOUT: Duration = Duration::from_secs(120);
const EXPIRED: u16 = 403;

pub struct Object<'a> {
    pub upload: &'a MediaUpload,
    pub object: UploadObject,
    pub target: PresignedPut,
    pub expires_at: Millis,
    pub body: Bytes,
}

enum Tried {
    Answered(u16),
    Broken(String),
    StageGone,
    Stuck(Snag),
}

impl Uploads {
    pub(super) async fn put(&self, mut object: Object<'_>) -> Result<(), Snag> {
        let mut resume = stage_of(object.upload, object.object);
        let mut hops = self.planned(&object, resume.as_ref());
        if hops.is_empty() {
            return Err(Snag::Failed(ChatError::Protocol));
        }
        let mut at = 0;
        while let Some(hop) = hops.get(at).cloned() {
            at += 1;
            if self.fresh(&mut object).await? {
                hops = self.planned(&object, resume.as_ref());
            }
            let tried = match hop.tier {
                Tier::Pro => {
                    let staged = resume
                        .as_ref()
                        .filter(|(node, _)| *node == hop.url)
                        .map(|(_, id)| id.clone());
                    self.staged(&mut object, &hop, staged).await
                }
                Tier::Relay | Tier::Direct => self.relayed(&object, &hop).await,
            };
            match tried {
                Tried::Answered(status) if (200..300).contains(&status) => {
                    hop.note(true);
                    return Ok(());
                }
                Tried::Answered(EXPIRED) => return Err(Snag::Expired),
                Tried::Answered(status) => {
                    diagnostics::warn(format!(
                        "[ChatUpload] {} answered {status}",
                        hop.tier_label()
                    ));
                }
                Tried::StageGone => resume = None,
                Tried::Broken(why) => {
                    hop.note(false);
                    diagnostics::warn(format!("[ChatUpload] {}: {why}", hop.tier_label()));
                }
                Tried::Stuck(snag) => return Err(snag),
            }
        }
        Err(Snag::Failed(ChatError::Offline))
    }

    fn planned(&self, object: &Object<'_>, resume: Option<&(String, String)>) -> Vec<Hop> {
        let mut hops = (self.routes)(&object.target.url);
        if let Some((node, _)) = resume {
            hops.sort_by_key(|hop| hop.tier != Tier::Pro || &hop.url != node);
        }
        hops
    }

    async fn fresh(&self, object: &mut Object<'_>) -> Result<bool, Snag> {
        if object.expires_at > self.now() {
            return Ok(false);
        }
        let upload = object.upload;
        self.forget_targets(upload.id);
        let mut reloaded = upload.clone();
        reloaded.presign_expires_at = None;
        let targets = self.targets(&reloaded).await?;
        let target = match object.object {
            UploadObject::Image => Some(targets.image),
            UploadObject::Thumb => targets.thumb,
        };
        object.target = target.ok_or(Snag::Failed(ChatError::Protocol))?;
        object.expires_at = targets.expires_at;
        Ok(true)
    }

    async fn relayed(&self, object: &Object<'_>, hop: &Hop) -> Tried {
        let (progress, seen) = watch::channel(Staging::default());
        let sent = plain(&hop.url, &object.target, object.body.clone(), progress);
        match self
            .recorded(object.upload.id, object.object, None, sent, seen)
            .await
        {
            Ok(status) => Tried::Answered(status),
            Err(why) => Tried::Broken(why),
        }
    }

    async fn staged(&self, object: &mut Object<'_>, hop: &Hop, resume: Option<String>) -> Tried {
        let (id, part) = (object.upload.id, object.object);
        let node = hop.url.as_str();
        let (progress, seen) = watch::channel(Staging::default());
        let filling = fill_stage(node, &object.body, resume.as_deref(), &progress);
        let filled = self
            .recorded(id, part, Some(node), filling, seen.clone())
            .await;
        let filled = match filled {
            Ok(filled) => filled,
            Err(failure) => return failed(failure),
        };
        if let Err(snag) = self.fresh(object).await {
            return Tried::Stuck(snag);
        }
        let asked = Asked {
            method: "PUT".into(),
            url: object.target.url.clone(),
            headers: headers(&object.target),
            body: None,
        };
        let opening = open_filled(node, &asked, &object.body, &filled, &progress);
        match self.recorded(id, part, Some(node), opening, seen).await {
            Ok(status) => Tried::Answered(status),
            Err(failure) => failed(failure),
        }
    }
}

fn failed(failure: StagedFailure) -> Tried {
    match failure {
        StagedFailure::Gone(_) => Tried::StageGone,
        StagedFailure::Link(why) => Tried::Broken(why),
    }
}

fn headers(target: &PresignedPut) -> Vec<(String, String)> {
    target
        .headers
        .iter()
        .map(|(name, value)| (name.clone(), value.clone()))
        .collect()
}

async fn plain(
    url: &str,
    target: &PresignedPut,
    body: Bytes,
    progress: watch::Sender<Staging>,
) -> Result<u16, String> {
    let client = client().ok_or("chat upload: http client is unavailable")?;
    let total = body.len();
    let unit = UNIT as usize;
    let chunks: Vec<Bytes> = (0..total)
        .step_by(unit)
        .map(|at| body.slice(at..(at + unit).min(total)))
        .collect();
    let mut handed = 0u64;
    let stream = futures_util::stream::iter(chunks.into_iter().map(move |chunk| {
        progress.send_replace(Staging {
            stage: None,
            sent: handed,
        });
        handed += chunk.len() as u64;
        Ok::<Bytes, std::io::Error>(chunk)
    }));
    let mut request = client.put(url).timeout(PUT_TIMEOUT);
    for (name, value) in &target.headers {
        request = request.header(name.as_str(), value.as_str());
    }
    let response = request
        .body(wreq::Body::wrap_stream(stream))
        .send()
        .await
        .map_err(|error| error.to_string())?;
    Ok(response.status().as_u16())
}

fn client() -> Option<&'static wreq::Client> {
    static CLIENT: OnceLock<Option<wreq::Client>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            system_proxy::follow(wreq::Client::builder())
                .connect_timeout(CONNECT_TIMEOUT)
                .build()
                .ok()
        })
        .as_ref()
}

pub fn stage_of(upload: &MediaUpload, object: UploadObject) -> Option<(String, String)> {
    if upload.object != object {
        return None;
    }
    let (node, id) = upload.stage_id.as_deref()?.split_once(' ')?;
    Some((node.to_string(), id.to_string()))
}

pub fn stage_label(node: &str, id: &str) -> String {
    format!("{node} {id}")
}

use bytes::Bytes;
use sc_chat::api::wire::PresignedPut;
use sc_chat::store::MediaUpload;
use sc_chat::{ChatError, Millis, UploadObject};
use tokio::sync::watch;

use super::engine::Uploads;
use super::errors::Snag;
use super::plain::plain;
use super::round::Round;
use crate::app::diagnostics;
use crate::network::edge::{Hop, Tier};
use crate::network::pro::{Asked, StagedFailure, Staging, fill_stage, open_filled};

pub const UNIT: u64 = 32 * 1024;
const REFUSED: u16 = 403;
const SIGN_AHEAD: Millis = 5 * 60 * 1000;

pub struct Object<'a> {
    pub upload: &'a MediaUpload,
    pub object: UploadObject,
    pub target: PresignedPut,
    pub expires_at: Millis,
    pub body: Bytes,
}

type Resume = Option<(String, String)>;

enum Tried {
    Answered(u16),
    Broken(String),
    StageGone(String),
    Stuck(Snag),
}

impl Uploads {
    pub(super) async fn put(&self, mut object: Object<'_>) -> Result<(), Snag> {
        if !sized(&object.target, object.body.len()) {
            diagnostics::error("[ChatUpload] the presign is for another length");
            return Err(Snag::Failed(ChatError::Protocol));
        }
        let mut resume = stage_of(object.upload, object.object);
        if self.planned(&object, resume.as_ref()).is_empty() {
            diagnostics::error("[ChatUpload] the presigned host has no route");
            return Err(Snag::Failed(ChatError::Protocol));
        }
        let mut round = Round::default();
        loop {
            let mut hops = self.planned(&object, resume.as_ref());
            if round.next(&hops).is_none() {
                break;
            }
            if self.fresh(&mut object, 0).await? {
                hops = self.planned(&object, resume.as_ref());
            }
            let Some(hop) = round.next(&hops) else {
                break;
            };
            round.tried_on(&hop);
            let tried = match hop.tier {
                Tier::Pro => self.staged(&mut object, &hop, &mut resume).await,
                Tier::Relay | Tier::Direct => self.relayed(&object, &hop, resume.as_ref()).await,
            };
            match tried {
                Tried::Answered(status) if (200..300).contains(&status) => {
                    hop.note(true);
                    round.sink_refusing();
                    return Ok(());
                }
                Tried::Answered(REFUSED) => {
                    diagnostics::warn(format!("[ChatUpload] {} answered 403", hop.tier_label()));
                    round.refusing.push(hop);
                }
                Tried::Answered(status) => {
                    diagnostics::warn(format!(
                        "[ChatUpload] {} answered {status}",
                        hop.tier_label()
                    ));
                    if status >= 500 {
                        round.missed(&hop);
                    }
                }
                Tried::StageGone(why) => {
                    diagnostics::warn(format!("[ChatUpload] pro stage lost: {why}"));
                }
                Tried::Broken(why) => {
                    diagnostics::warn(format!("[ChatUpload] {}: {why}", hop.tier_label()));
                    round.missed(&hop);
                }
                Tried::Stuck(snag) => return Err(snag),
            }
        }
        round.ended()
    }

    fn planned(&self, object: &Object<'_>, resume: Option<&(String, String)>) -> Vec<Hop> {
        let mut hops = (self.routes)(&object.target.url);
        if let Some((node, _)) = resume {
            hops.sort_by_key(|hop| hop.tier != Tier::Pro || &hop.url != node);
        }
        hops
    }

    async fn fresh(&self, object: &mut Object<'_>, ahead: Millis) -> Result<bool, Snag> {
        if object.expires_at > self.now().saturating_add(ahead) {
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

    async fn relayed(
        &self,
        object: &Object<'_>,
        hop: &Hop,
        resume: Option<&(String, String)>,
    ) -> Tried {
        let kept = resume.map(|(node, id)| stage_label(node, id));
        let (progress, seen) = watch::channel(Staging::default());
        let sent = plain(&hop.url, &object.target, object.body.clone(), progress);
        let label = |_: &Staging| kept.clone();
        match self
            .recorded(object.upload.id, object.object, label, sent, seen)
            .await
        {
            Ok(status) => Tried::Answered(status),
            Err(why) => Tried::Broken(why),
        }
    }

    async fn staged(&self, object: &mut Object<'_>, hop: &Hop, resume: &mut Resume) -> Tried {
        let (id, part) = (object.upload.id, object.object);
        let node = hop.url.as_str();
        if let Err(snag) = self.fresh(object, SIGN_AHEAD).await {
            return Tried::Stuck(snag);
        }
        let kept = resume.as_ref().map(|(node, id)| stage_label(node, id));
        let ours = resume
            .as_ref()
            .filter(|(at, _)| at == node)
            .map(|(_, id)| id.clone());
        let label = |staging: &Staging| {
            staging
                .stage
                .as_deref()
                .map(|stage| stage_label(node, stage))
                .or_else(|| kept.clone())
        };
        let (progress, seen) = watch::channel(Staging::default());
        let filling = fill_stage(node, &object.body, ours.as_deref(), &progress);
        let filled = self.recorded(id, part, label, filling, seen.clone()).await;
        kept_stage(resume, node, &seen);
        let filled = match filled {
            Ok(filled) => filled,
            Err(failure) => return failed(failure, resume),
        };
        if let Err(snag) = self.fresh(object, 0).await {
            return Tried::Stuck(snag);
        }
        let asked = Asked {
            method: "PUT".into(),
            url: object.target.url.clone(),
            headers: headers(&object.target),
            body: None,
        };
        let opening = open_filled(node, &asked, &object.body, &filled, &progress);
        let opened = self.recorded(id, part, label, opening, seen.clone()).await;
        kept_stage(resume, node, &seen);
        match opened {
            Ok(status) => {
                *resume = None;
                Tried::Answered(status)
            }
            Err(failure) => failed(failure, resume),
        }
    }
}

fn kept_stage(resume: &mut Resume, node: &str, seen: &watch::Receiver<Staging>) {
    if let Some(stage) = seen.borrow().stage.clone() {
        *resume = Some((node.to_string(), stage));
    }
}

fn failed(failure: StagedFailure, resume: &mut Resume) -> Tried {
    match failure {
        StagedFailure::Gone(why) => {
            *resume = None;
            Tried::StageGone(why)
        }
        StagedFailure::Link(why) => Tried::Broken(why),
    }
}

fn sized(target: &PresignedPut, len: usize) -> bool {
    target
        .headers
        .iter()
        .filter(|(name, _)| name.eq_ignore_ascii_case("content-length"))
        .all(|(_, value)| value.trim().parse::<usize>() == Ok(len))
}

fn headers(target: &PresignedPut) -> Vec<(String, String)> {
    target
        .headers
        .iter()
        .map(|(name, value)| (name.clone(), value.clone()))
        .collect()
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

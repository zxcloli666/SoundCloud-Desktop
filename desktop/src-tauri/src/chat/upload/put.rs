use std::sync::OnceLock;
use std::time::Duration;

use bytes::Bytes;
use sc_chat::api::wire::PresignedPut;
use sc_chat::store::MediaUpload;
use sc_chat::{ChatError, UploadObject};
use tokio::sync::watch;

use super::engine::Uploads;
use super::errors::Snag;
use crate::app::diagnostics;
use crate::network::edge::{Hop, Tier};
use crate::network::pro::{Asked, StagedFailure, Staging, put_staged};
use crate::network::system_proxy;

pub const UNIT: u64 = 32 * 1024;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const PUT_TIMEOUT: Duration = Duration::from_secs(120);
const EXPIRED: u16 = 403;

pub struct Object<'a> {
    pub upload: &'a MediaUpload,
    pub object: UploadObject,
    pub target: &'a PresignedPut,
    pub body: Bytes,
}

enum Tried {
    Answered(u16),
    Broken(String),
    StageGone,
}

impl Uploads {
    pub(super) async fn put(&self, object: Object<'_>) -> Result<(), Snag> {
        let resume = stage_of(object.upload, object.object);
        let mut hops = (self.routes)(&object.target.url);
        if let Some((node, _)) = &resume {
            hops.sort_by_key(|hop| hop.tier != Tier::Pro || &hop.url != node);
        }
        if hops.is_empty() {
            return Err(Snag::Failed(ChatError::Protocol));
        }
        let headers: Vec<(String, String)> = object
            .target
            .headers
            .iter()
            .map(|(name, value)| (name.clone(), value.clone()))
            .collect();
        let mut resume = resume;
        for hop in &hops {
            let staged = resume
                .as_ref()
                .filter(|(node, _)| *node == hop.url)
                .map(|(_, id)| id.clone());
            match self.attempt(&object, hop, &headers, staged).await {
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
            }
        }
        Err(Snag::Failed(ChatError::Offline))
    }

    async fn attempt(
        &self,
        object: &Object<'_>,
        hop: &Hop,
        headers: &[(String, String)],
        staged: Option<String>,
    ) -> Tried {
        let (progress, seen) = watch::channel(Staging::default());
        let id = object.upload.id;
        let node = (hop.tier == Tier::Pro).then(|| hop.url.clone());
        let body = object.body.clone();
        let tried = async move {
            match &node {
                Some(node) => {
                    let asked = Asked {
                        method: "PUT".into(),
                        url: object.target.url.clone(),
                        headers: headers.to_vec(),
                        body: None,
                    };
                    match put_staged(node, &asked, &body, staged.as_deref(), &progress).await {
                        Ok(status) => Tried::Answered(status),
                        Err(StagedFailure::Gone(_)) => Tried::StageGone,
                        Err(StagedFailure::Link(why)) => Tried::Broken(why),
                    }
                }
                None => match plain(&hop.url, headers, body, progress).await {
                    Ok(status) => Tried::Answered(status),
                    Err(why) => Tried::Broken(why),
                },
            }
        };
        let node = (hop.tier == Tier::Pro).then_some(hop.url.as_str());
        self.recorded(id, object.object, node, tried, seen).await
    }
}

async fn plain(
    url: &str,
    headers: &[(String, String)],
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
    for (name, value) in headers {
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

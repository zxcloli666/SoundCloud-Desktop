use std::future::Future;

use sc_chat::UploadObject;
use tokio::sync::watch;
use uuid::Uuid;

use super::engine::Uploads;
use super::put::{UNIT, stage_label};
use crate::network::pro::Staging;

type Mark = (Option<String>, u32);

impl Uploads {
    pub(super) async fn recorded<F: Future>(
        &self,
        id: Uuid,
        object: UploadObject,
        node: Option<&str>,
        attempt: F,
        mut seen: watch::Receiver<Staging>,
    ) -> F::Output {
        tokio::pin!(attempt);
        let mut last: Option<Mark> = None;
        loop {
            tokio::select! {
                biased;
                done = &mut attempt => return done,
                changed = seen.changed() => {
                    if changed.is_err() {
                        return attempt.await;
                    }
                    let staging = seen.borrow_and_update().clone();
                    let stage = node.zip(staging.stage.as_deref()).map(|(node, id)| stage_label(node, id));
                    let mark = (stage, units(staging.sent));
                    if last.as_ref() != Some(&mark) {
                        self.note(id, object, &mark).await;
                        last = Some(mark);
                    }
                }
            }
        }
    }

    async fn note(&self, id: Uuid, object: UploadObject, mark: &Mark) {
        let (stage, parts) = mark.clone();
        let now = self.now();
        let _ = self
            .blocking(move |store| store.upload_progress(id, object, parts, stage.as_deref(), now))
            .await;
    }
}

fn units(sent: u64) -> u32 {
    u32::try_from(sent / UNIT).unwrap_or(u32::MAX)
}

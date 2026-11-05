use sc_chat::store::MediaUpload;

use super::engine::Uploads;
use crate::chat::download::Part;

impl Uploads {
    pub(super) async fn seed_cache(&self, rows: &[MediaUpload]) {
        for upload in rows {
            let Some(media_id) = upload.media_id else {
                continue;
            };
            let parts = [
                (Part::Image, Some(&upload.image_ref)),
                (Part::Thumb, upload.thumb_ref.as_ref()),
            ];
            for (part, name) in parts {
                let Some(name) = name else {
                    continue;
                };
                let Some(sealed) = self.files.read_named(name).await else {
                    continue;
                };
                let cache = self.cache.clone();
                let kept = tokio::task::spawn_blocking(move || cache.put(media_id, part, &sealed));
                let _ = kept.await;
            }
        }
    }
}

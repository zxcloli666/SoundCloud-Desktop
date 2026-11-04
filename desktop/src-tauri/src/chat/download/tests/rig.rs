use std::io::Cursor;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use image::codecs::png::PngEncoder;
use image::{ImageEncoder, RgbImage};
use sc_chat::api::{Api, Identity};
use sc_chat::channel::Channel;
use sc_chat::crypto::DeviceKeys;
use sc_chat::media::prepare_image;
use sc_chat::sc_chat_wire::proto::Attachment;
use sc_chat::{ChatResult, ConvId};
use uuid::Uuid;

use super::super::engine::Routes;
use super::super::{Downloads, Fetched, MediaState, Part};
use super::world::{self, World};
use crate::chat::media_cache::MediaCache;
use crate::chat::runtime::SystemClock;
use crate::network::edge::{Hop, Tier};

pub struct Media {
    pub attachment: Attachment,
    pub image_id: Uuid,
    pub thumb_id: Uuid,
    pub image: Vec<u8>,
    pub thumb: Vec<u8>,
}

pub struct Rig {
    pub world: Arc<World>,
    pub api: Arc<Api>,
    pub dir: PathBuf,
    pub cache: Arc<MediaCache>,
    pub downloads: Arc<Downloads>,
    pub conversation: ConvId,
    pub notices: Arc<Mutex<Vec<MediaState>>>,
    hops: Arc<Mutex<Vec<String>>>,
}

impl Rig {
    pub fn new() -> Self {
        Self::capped(crate::chat::media_cache::CAP)
    }

    pub fn capped(cap: u64) -> Self {
        let world = World::start();
        let dir = std::env::temp_dir().join(format!("chat-download-{}", Uuid::new_v4().simple()));
        std::fs::create_dir_all(&dir).unwrap();
        let cache = Arc::new(MediaCache::with_cap(&dir, cap));
        let notices = Arc::new(Mutex::new(Vec::new()));
        let hops = Arc::new(Mutex::new(vec![world.s3.clone()]));
        let fake = Arc::new(world::Api(world.clone()));
        let api = Api::with_exchange(
            Arc::new(Channel::new(Arc::new(SystemClock))),
            fake.clone(),
            fake,
        );
        api.set_identity(Some(Identity {
            session_id: "session".into(),
            device_id: Uuid::new_v4(),
            keys: Arc::new(DeviceKeys::generate().unwrap()),
        }));
        let api = Arc::new(api);
        let seen = notices.clone();
        let downloads = Arc::new(Downloads::routed(
            api.clone(),
            cache.clone(),
            Arc::new(move |change| seen.lock().unwrap().push(change)),
            routes(world.s3.clone(), hops.clone()),
        ));
        Self {
            world,
            api,
            dir,
            cache,
            downloads,
            conversation: Uuid::new_v4(),
            notices,
            hops,
        }
    }

    pub fn route(&self, via: &[&str]) {
        *self.hops.lock().unwrap() = via.iter().map(|via| via.to_string()).collect();
    }

    pub fn media(&self, seed: u64) -> Media {
        let prepared = prepare_image(&noisy(640, 480, seed)).unwrap();
        let image_id = Uuid::new_v4();
        let thumb_id = Uuid::new_v4();
        let mut attachment = prepared.attachment;
        attachment.media_id = image_id.to_string();
        if let Some(thumb) = attachment.thumb.as_mut() {
            thumb.media_id = thumb_id.to_string();
        }
        Media {
            attachment,
            image_id,
            thumb_id,
            image: prepared.image,
            thumb: prepared.thumb,
        }
    }

    pub fn uploaded(&self, seed: u64) -> Media {
        let media = self.media(seed);
        self.world.store(media.image_id, media.image.clone());
        self.world.store(media.thumb_id, media.thumb.clone());
        media
    }

    pub async fn load(&self, media: &Media, part: Part) -> ChatResult<Fetched> {
        self.downloads
            .fetch(self.conversation, media.attachment.clone(), part)
            .await
    }

    pub fn notices(&self) -> Vec<MediaState> {
        self.notices.lock().unwrap().clone()
    }
}

impl Drop for Rig {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

pub fn shown(fetched: &Fetched) -> &'static str {
    match fetched {
        Fetched::Image(picture) => {
            assert!(!picture.bytes.is_empty());
            picture.mime
        }
        Fetched::Deleted => "deleted",
        Fetched::Lost => "lost",
    }
}

pub fn noisy(width: u32, height: u32, seed: u64) -> Vec<u8> {
    let mut state = seed | 1;
    let pixels = RgbImage::from_fn(width, height, |x, y| {
        state ^= state << 13;
        state ^= state >> 7;
        state ^= state << 17;
        let grain = (state & 0x3f) as u32;
        image::Rgb([
            ((x * 255 / width) + grain).min(255) as u8,
            ((y * 255 / height) + grain).min(255) as u8,
            (grain * 3).min(255) as u8,
        ])
    });
    let mut png = Cursor::new(Vec::new());
    PngEncoder::new(&mut png)
        .write_image(&pixels, width, height, image::ExtendedColorType::Rgb8)
        .unwrap();
    png.into_inner()
}

fn routes(s3: String, hops: Arc<Mutex<Vec<String>>>) -> Routes {
    Arc::new(move |url: &str| {
        hops.lock()
            .unwrap()
            .iter()
            .map(|via| Hop {
                url: url.replacen(&s3, via, 1),
                tier: Tier::Relay,
                origin: String::new(),
            })
            .collect()
    })
}

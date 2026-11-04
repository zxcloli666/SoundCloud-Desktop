use std::io::Cursor;

use image::ImageEncoder;
use image::codecs::png::PngEncoder;
use sc_chat::media::{MediaError, MediaWorker, OpenedImage, open_image, open_thumb};
use sc_chat::sc_chat_wire::proto::Attachment;

use super::{Fetched, Part, Picture};

const PNG: &str = "image/png";
const THUMBHASH_MAX: usize = 64;

pub enum Opened {
    Image(Picture),
    Busy,
    Bad,
}

pub async fn sealed(
    worker: MediaWorker,
    cipher: Vec<u8>,
    attachment: Attachment,
    part: Part,
) -> Opened {
    let opened = tokio::task::spawn_blocking(move || match (part, &attachment.thumb) {
        (Part::Thumb, Some(thumb)) => open_thumb(&worker, &cipher, thumb),
        _ => open_image(&worker, &cipher, &attachment),
    })
    .await;
    match opened {
        Ok(Ok(OpenedImage { bytes, mime, .. })) => Opened::Image(Picture { bytes, mime }),
        Ok(Err(MediaError::Busy | MediaError::TimedOut)) => Opened::Busy,
        Ok(Err(_)) => Opened::Bad,
        Err(_) => Opened::Bad,
    }
}

pub async fn placeholder(thumbhash: Vec<u8>) -> Fetched {
    let drawn = tokio::task::spawn_blocking(move || draw(&thumbhash)).await;
    match drawn {
        Ok(Some(bytes)) => Fetched::Image(Picture { bytes, mime: PNG }),
        _ => Fetched::Lost,
    }
}

fn draw(thumbhash: &[u8]) -> Option<Vec<u8>> {
    if thumbhash.is_empty() || thumbhash.len() > THUMBHASH_MAX {
        return None;
    }
    let (w, h, rgba) = thumbhash::thumb_hash_to_rgba(thumbhash).ok()?;
    if w == 0 || h == 0 || rgba.len() != w * h * 4 {
        return None;
    }
    let mut png = Cursor::new(Vec::new());
    PngEncoder::new(&mut png)
        .write_image(
            &rgba,
            u32::try_from(w).ok()?,
            u32::try_from(h).ok()?,
            image::ExtendedColorType::Rgba8,
        )
        .ok()?;
    Some(png.into_inner())
}

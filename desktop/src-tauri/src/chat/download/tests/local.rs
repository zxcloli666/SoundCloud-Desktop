use image::codecs::gif::GifEncoder;
use image::{Delay, Frame, Rgba, RgbaImage};
use sc_chat::media::prepare_image;
use sc_chat::store::MediaUpload;
use sc_chat::{MediaKind, UploadObject, UploadState};
use uuid::Uuid;

use super::super::{Fetched, Part};
use super::rig::{Rig, shown};

fn upload(rig: &Rig, seed: u64, image_ref: &str, thumb_ref: Option<&str>) -> MediaUpload {
    let media = rig.media(seed);
    let uploads = rig.dir.join("uploads");
    std::fs::create_dir_all(&uploads).unwrap();
    std::fs::write(uploads.join(image_ref), &media.image).unwrap();
    if let Some(thumb_ref) = thumb_ref {
        std::fs::write(uploads.join(thumb_ref), &media.thumb).unwrap();
    }
    MediaUpload {
        id: Uuid::new_v4(),
        album: Uuid::new_v4(),
        position: 0,
        conversation_id: rig.conversation,
        kind: MediaKind::Image,
        image_ref: image_ref.to_owned(),
        thumb_ref: thumb_ref.map(str::to_owned),
        motion_ref: None,
        attachment: media.attachment,
        state: UploadState::Uploading,
        object: UploadObject::Thumb,
        media_id: None,
        stage_id: None,
        parts_sent: 0,
        presign_expires_at: None,
        attempts: 0,
        created_at: 0,
        updated_at: 0,
    }
}

#[tokio::test]
async fn a_local_upload_opens_its_sealed_files() {
    let rig = Rig::new();
    let local = upload(&rig, 61, "a1.img", Some("a1.thumb"));

    let thumb = rig
        .downloads
        .local(local.clone(), Part::Thumb)
        .await
        .unwrap();
    let image = rig.downloads.local(local, Part::Image).await.unwrap();

    assert_eq!(shown(&thumb), "image/jpeg");
    assert_eq!(shown(&image), "image/jpeg");
    assert!(rig.world.urls_calls().is_empty());
}

#[tokio::test]
async fn a_missing_or_escaping_local_file_is_lost() {
    let rig = Rig::new();
    let mut local = upload(&rig, 62, "b1.img", None);
    std::fs::write(rig.dir.join("outside.img"), b"secret").unwrap();

    local.image_ref = "../outside.img".to_owned();
    let escaping = rig
        .downloads
        .local(local.clone(), Part::Image)
        .await
        .unwrap();
    local.image_ref = "gone.img".to_owned();
    let missing = rig.downloads.local(local, Part::Image).await.unwrap();

    assert_eq!(escaping, Fetched::Lost);
    assert_eq!(missing, Fetched::Lost);
}

#[tokio::test]
async fn a_damaged_local_file_is_lost() {
    let rig = Rig::new();
    let local = upload(&rig, 63, "c1.img", Some("c1.thumb"));
    std::fs::write(rig.dir.join("uploads").join("c1.thumb"), b"not sealed").unwrap();

    let thumb = rig.downloads.local(local, Part::Thumb).await.unwrap();

    assert_eq!(thumb, Fetched::Lost);
}

#[tokio::test]
async fn an_avatar_upload_has_only_an_image() {
    let rig = Rig::new();
    let mut local = upload(&rig, 64, "d1.img", None);
    local.kind = MediaKind::Avatar;
    local.attachment.thumb = None;

    let thumb = rig.downloads.local(local, Part::Thumb).await.unwrap();

    assert_eq!(shown(&thumb), "image/jpeg");
}

#[tokio::test]
async fn a_gif_upload_plays_its_motion_and_falls_back_to_the_still() {
    let rig = Rig::new();
    let prepared = prepare_image(&gif()).unwrap();
    let mut local = upload(&rig, 65, "e1.img", Some("e1.thumb"));
    let uploads = rig.dir.join("uploads");
    std::fs::write(uploads.join("e1.img"), &prepared.image).unwrap();
    std::fs::write(uploads.join("e1.thumb"), &prepared.thumb).unwrap();
    std::fs::write(uploads.join("e1.motion"), prepared.motion.unwrap()).unwrap();
    local.attachment = prepared.attachment;
    local.motion_ref = Some("e1.motion".to_owned());

    let motion = rig
        .downloads
        .local(local.clone(), Part::Motion)
        .await
        .unwrap();
    local.motion_ref = None;
    let still = rig.downloads.local(local, Part::Motion).await.unwrap();

    assert_eq!(shown(&motion), "image/webp");
    assert_eq!(shown(&still), "image/jpeg");
}

fn gif() -> Vec<u8> {
    let mut out = Vec::new();
    let frames = (0..3u8).map(|step| {
        let image = RgbaImage::from_fn(64, 48, |x, _| Rgba([step * 80, x as u8 * 4, 90, 255]));
        Frame::from_parts(image, 0, 0, Delay::from_numer_denom_ms(100, 1))
    });
    GifEncoder::new(&mut out).encode_frames(frames).unwrap();
    out
}

use sc_chat::ChatError;

use super::super::{Fetched, Gone, Part};
use super::rig::{Rig, shown};

#[tokio::test]
async fn a_miss_downloads_checks_caches_and_opens() {
    let rig = Rig::new();
    let media = rig.uploaded(1);

    let image = rig.load(&media, Part::Image).await.unwrap();
    let thumb = rig.load(&media, Part::Thumb).await.unwrap();

    assert_eq!(shown(&image), "image/jpeg");
    assert_eq!(shown(&thumb), "image/jpeg");
    assert_eq!(
        rig.cache.get(media.image_id, Part::Image).unwrap(),
        Some(media.image.clone())
    );
    assert_eq!(
        rig.cache.get(media.image_id, Part::Thumb).unwrap(),
        Some(media.thumb.clone())
    );
    assert_eq!(rig.world.gets_of(media.image_id), 1);
    assert_eq!(rig.world.gets_of(media.thumb_id), 1);
}

#[tokio::test]
async fn a_cache_hit_needs_no_network() {
    let rig = Rig::new();
    let media = rig.uploaded(2);
    let first = rig.load(&media, Part::Image).await.unwrap();
    let calls = rig.world.urls_calls().len();

    rig.route(&[]);
    let again = rig.load(&media, Part::Image).await.unwrap();

    assert_eq!(first, again);
    assert_eq!(rig.world.urls_calls().len(), calls);
    assert_eq!(rig.world.gets_of(media.image_id), 1);
}

#[tokio::test]
async fn a_dead_relay_falls_through_to_the_next_hop() {
    let rig = Rig::new();
    let media = rig.uploaded(3);
    rig.route(&[&rig.world.dead.clone(), &rig.world.s3.clone()]);

    let image = rig.load(&media, Part::Image).await.unwrap();

    assert_eq!(shown(&image), "image/jpeg");
}

#[tokio::test]
async fn no_reachable_hop_is_retryable() {
    let rig = Rig::new();
    let media = rig.uploaded(4);
    rig.route(&[&rig.world.dead.clone()]);

    let failed = rig.load(&media, Part::Image).await;

    assert_eq!(failed, Err(ChatError::Offline));
    assert_eq!(rig.cache.get(media.image_id, Part::Image).unwrap(), None);
    assert!(rig.notices().is_empty());

    rig.route(&[&rig.world.s3.clone()]);
    let image = rig.load(&media, Part::Image).await.unwrap();
    assert_eq!(shown(&image), "image/jpeg");
}

#[tokio::test]
async fn a_wrong_sha256_is_refused_and_never_cached() {
    let rig = Rig::new();
    let media = rig.uploaded(5);
    rig.route(&[&rig.world.tampering.clone()]);

    let refused = rig.load(&media, Part::Image).await.unwrap();

    assert_eq!(refused, Fetched::Lost);
    assert_eq!(rig.cache.get(media.image_id, Part::Image).unwrap(), None);
    assert!(rig.world.with(|state| state.tampered_gets) >= 1);
    assert_eq!(rig.refused_notices(), vec![rig.told(&media, Gone::Lost)]);
}

#[tokio::test]
async fn a_tampering_relay_is_skipped_for_an_honest_one() {
    let rig = Rig::new();
    let media = rig.uploaded(6);
    rig.route(&[&rig.world.tampering.clone(), &rig.world.s3.clone()]);

    let image = rig.load(&media, Part::Image).await.unwrap();
    let thumb = rig.load(&media, Part::Thumb).await.unwrap();

    assert_eq!(shown(&image), "image/jpeg");
    assert_eq!(shown(&thumb), "image/jpeg");
    assert_eq!(rig.world.with(|state| state.tampered_gets), 2);
}

#[tokio::test]
async fn a_tampered_thumb_fails_its_aead_and_is_not_cached() {
    let rig = Rig::new();
    let media = rig.uploaded(7);
    rig.world
        .with(|state| state.tamper_all.insert(media.thumb_id));

    let thumb = rig.load(&media, Part::Thumb).await.unwrap();

    assert_eq!(thumb, Fetched::Lost);
    assert_eq!(rig.cache.get(media.image_id, Part::Thumb).unwrap(), None);
    assert_eq!(rig.refused_notices(), vec![rig.told(&media, Gone::Lost)]);
}

#[tokio::test]
async fn a_corrupt_cache_entry_is_fetched_again() {
    let rig = Rig::new();
    let media = rig.uploaded(8);
    let mut broken = media.image.clone();
    broken[10] ^= 1;
    rig.cache.put(media.image_id, Part::Image, &broken).unwrap();

    let image = rig.load(&media, Part::Image).await.unwrap();

    assert_eq!(shown(&image), "image/jpeg");
    assert_eq!(
        rig.cache.get(media.image_id, Part::Image).unwrap(),
        Some(media.image.clone())
    );
    assert!(rig.notices().is_empty());
}

#[tokio::test]
async fn an_avatar_has_no_thumb_and_serves_its_image() {
    let rig = Rig::new();
    let mut media = rig.uploaded(14);
    media.attachment.thumb = None;

    let thumb = rig.load(&media, Part::Thumb).await.unwrap();

    assert_eq!(shown(&thumb), "image/jpeg");
    assert_eq!(rig.world.gets_of(media.image_id), 1);
    assert_eq!(rig.world.gets_of(media.thumb_id), 0);
}

#[tokio::test]
async fn an_oversized_body_is_refused() {
    let rig = Rig::new();
    let mut media = rig.uploaded(15);
    let mut longer = media.image.clone();
    longer.extend_from_slice(&[0; 4096]);
    rig.world.store(media.image_id, longer);
    media.attachment.sha256_cipher.clear();

    let image = rig.load(&media, Part::Image).await.unwrap();

    assert_eq!(image, Fetched::Lost);
    assert_eq!(rig.cache.get(media.image_id, Part::Image).unwrap(), None);
    assert_eq!(rig.refused_notices(), vec![rig.told(&media, Gone::Lost)]);
}

#[tokio::test]
async fn refused_content_is_not_fetched_again_at_once() {
    let rig = Rig::new();
    let media = rig.uploaded(17);
    rig.world
        .with(|state| state.tamper_all.insert(media.image_id));

    let first = rig.load(&media, Part::Image).await.unwrap();
    let again = rig.load(&media, Part::Image).await.unwrap();

    assert_eq!((first, again), (Fetched::Lost, Fetched::Lost));
    assert_eq!(rig.world.gets_of(media.image_id), 1);
    let lost = rig.told(&media, Gone::Lost);
    assert_eq!(rig.refused_notices(), vec![lost.clone(), lost]);
}

#[tokio::test]
async fn a_retry_fetches_refused_content_again() {
    let rig = Rig::new();
    let media = rig.uploaded(19);
    rig.world
        .with(|state| state.tamper_all.insert(media.image_id));
    assert_eq!(rig.load(&media, Part::Image).await.unwrap(), Fetched::Lost);

    rig.world
        .with(|state| state.tamper_all.remove(&media.image_id));
    rig.downloads.forget(media.image_id);
    let image = rig.load(&media, Part::Image).await.unwrap();

    assert!(matches!(image, Fetched::Image(_)));
    assert_eq!(rig.world.gets_of(media.image_id), 2);
}

#[tokio::test]
async fn a_body_that_does_not_open_with_its_key_is_lost_and_dropped() {
    let rig = Rig::new();
    let mut media = rig.uploaded(18);
    media.attachment.key = vec![9; 32];

    let image = rig.load(&media, Part::Image).await.unwrap();

    assert_eq!(image, Fetched::Lost);
    assert_eq!(rig.cache.get(media.image_id, Part::Image).unwrap(), None);
    assert_eq!(rig.refused_notices(), vec![rig.told(&media, Gone::Lost)]);
}

#[tokio::test]
async fn an_attachment_without_a_valid_id_is_lost() {
    let rig = Rig::new();
    let mut media = rig.uploaded(19);
    media.attachment.media_id = "not-a-uuid".to_owned();

    let image = rig.load(&media, Part::Image).await.unwrap();

    assert_eq!(image, Fetched::Lost);
    assert!(rig.world.urls_calls().is_empty());
    assert_eq!(rig.notices(), vec![rig.told(&media, Gone::Lost)]);
}

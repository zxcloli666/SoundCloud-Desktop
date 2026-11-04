use sc_chat::ChatError;

use super::super::{Fetched, Gone, MediaState, Part};
use super::rig::{Media, Rig, shown};

#[tokio::test]
async fn a_404_asks_urls_once_more_then_answers_lost() {
    let rig = Rig::new();
    let media = rig.media(9);
    rig.cache
        .put(media.image_id, Part::Image, &media.image)
        .unwrap();

    let thumb = rig.load(&media, Part::Thumb).await.unwrap();

    assert_eq!(thumb, Fetched::Lost);
    assert_eq!(
        rig.world.urls_calls(),
        vec![vec![media.thumb_id], vec![media.thumb_id]]
    );
    assert_eq!(rig.world.gets_of(media.thumb_id), 2);
    assert_eq!(
        rig.cache.get(media.image_id, Part::Image).unwrap(),
        Some(media.image.clone())
    );
    assert!(rig.notices().is_empty());
}

#[tokio::test]
async fn a_404_heals_when_the_second_url_works() {
    let rig = Rig::new();
    let media = rig.media(10);
    let world = rig.world.clone();
    let image_id = media.image_id;
    let bytes = media.image.clone();
    let healer = tokio::spawn(async move {
        while world.gets_of(image_id) == 0 {
            tokio::time::sleep(std::time::Duration::from_millis(2)).await;
        }
        world.store(image_id, bytes);
    });

    let image = rig.load(&media, Part::Image).await.unwrap();
    healer.await.unwrap();

    assert_eq!(shown(&image), "image/jpeg");
    assert_eq!(rig.world.urls_calls().len(), 2);
    assert!(rig.notices().is_empty());
}

#[tokio::test]
async fn deleted_from_urls_drops_every_cached_part() {
    let rig = Rig::new();
    let media = rig.media(11);
    rig.cache
        .put(media.image_id, Part::Image, &media.image)
        .unwrap();
    rig.world
        .with(|state| state.gone.insert(media.thumb_id, "deleted"));

    let thumb = rig.load(&media, Part::Thumb).await.unwrap();

    assert_eq!(thumb, Fetched::Deleted);
    assert_eq!(rig.cache.get(media.image_id, Part::Image).unwrap(), None);
    assert_eq!(rig.cache.size().unwrap(), 0);
    assert_eq!(
        rig.notices(),
        vec![MediaState {
            conversation_id: rig.conversation,
            media_id: media.image_id,
            state: Gone::Deleted,
        }]
    );
    assert_eq!(rig.world.gets_of(media.thumb_id), 0);
}

#[tokio::test]
async fn lost_from_urls_drops_the_cache_and_tells_the_ui() {
    let rig = Rig::new();
    let media = rig.media(12);
    rig.cache
        .put(media.image_id, Part::Thumb, &media.thumb)
        .unwrap();
    rig.world
        .with(|state| state.gone.insert(media.image_id, "lost"));

    let image = rig.load(&media, Part::Image).await.unwrap();

    assert_eq!(image, Fetched::Lost);
    assert_eq!(rig.cache.get(media.image_id, Part::Thumb).unwrap(), None);
    assert_eq!(rig.notices()[0].state, Gone::Lost);
    let wire = serde_json::to_value(&rig.notices()[0]).unwrap();
    assert_eq!(wire["state"], "lost");
    assert_eq!(wire["mediaId"], media.image_id.to_string());
    assert_eq!(wire["conversationId"], rig.conversation.to_string());
}

#[tokio::test]
async fn a_rate_limited_urls_call_is_retryable_and_keeps_the_cache() {
    let rig = Rig::new();
    let media = rig.media(13);
    rig.cache
        .put(media.image_id, Part::Thumb, &media.thumb)
        .unwrap();
    rig.world.with(|state| {
        state.urls_status = Some((429, serde_json::json!({"error": "chat_read_limited"})))
    });

    let failed = rig.load(&media, Part::Image).await;

    assert_eq!(failed, Err(ChatError::Offline));
    assert!(
        rig.cache
            .get(media.image_id, Part::Thumb)
            .unwrap()
            .is_some()
    );
    assert!(rig.notices().is_empty());
}

#[tokio::test]
async fn one_media_in_two_conversations_is_judged_per_conversation() {
    let rig = Rig::new();
    let media: Media = rig.uploaded(16);
    let banned = uuid::Uuid::new_v4();
    rig.world.with(|state| state.denied.insert(banned));

    let (allowed, denied) = tokio::join!(
        rig.load(&media, Part::Image),
        rig.downloads
            .fetch(banned, media.attachment.clone(), Part::Image)
    );

    assert_eq!(shown(&allowed.unwrap()), "image/jpeg");
    assert_eq!(denied.unwrap(), Fetched::Deleted);
    assert_eq!(
        rig.cache.get(media.image_id, Part::Image).unwrap(),
        Some(media.image.clone())
    );
    assert!(rig.notices().is_empty());
}

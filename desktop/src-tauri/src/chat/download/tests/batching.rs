use std::collections::HashSet;

use std::sync::Arc;

use futures_util::future::join_all;
use uuid::Uuid;

use super::super::Part;
use super::super::signed::{Link, Signer};
use super::rig::{Rig, shown};

#[tokio::test]
async fn concurrent_loads_of_one_image_share_one_download() {
    let rig = Rig::new();
    let media = rig.uploaded(21);

    let loads = join_all((0..8).map(|_| rig.load(&media, Part::Image))).await;

    for loaded in &loads {
        assert_eq!(shown(loaded.as_ref().unwrap()), "image/jpeg");
    }
    assert_eq!(rig.world.gets_of(media.image_id), 1);
    assert_eq!(rig.world.urls_calls(), vec![vec![media.image_id]]);
}

#[tokio::test]
async fn concurrent_misses_in_one_conversation_share_one_urls_call() {
    let rig = Rig::new();
    let signer = Arc::new(Signer::new(rig.api.clone()));
    let ids = (0..5).map(|_| Uuid::new_v4()).collect::<Vec<_>>();

    let links = join_all(
        ids.iter()
            .map(|id| signer.link(rig.conversation, *id, false)),
    )
    .await;

    assert!(links.iter().all(|link| matches!(link, Ok(Link::Url(_)))));
    let calls = rig.world.urls_calls();
    assert_eq!(calls.len(), 1);
    assert_eq!(
        calls[0].iter().copied().collect::<HashSet<_>>(),
        ids.iter().copied().collect::<HashSet<_>>()
    );
}

#[tokio::test]
async fn one_urls_call_carries_at_most_100_ids() {
    let rig = Rig::new();
    let signer = Arc::new(Signer::new(rig.api.clone()));
    let ids = (0..130).map(|_| Uuid::new_v4()).collect::<Vec<_>>();

    let links = join_all(
        ids.iter()
            .map(|id| signer.link(rig.conversation, *id, false)),
    )
    .await;

    assert!(links.iter().all(|link| matches!(link, Ok(Link::Url(_)))));
    let calls = rig.world.urls_calls();
    assert_eq!(
        calls.iter().map(Vec::len).collect::<Vec<_>>(),
        vec![100, 30]
    );
    assert_eq!(calls.concat(), ids);
}

#[tokio::test]
async fn a_later_miss_starts_its_own_batch() {
    let rig = Rig::new();
    let signer = Arc::new(Signer::new(rig.api.clone()));
    let (first, late) = (Uuid::new_v4(), Uuid::new_v4());

    let early = signer.link(rig.conversation, first, false).await.unwrap();
    let joined = signer.link(rig.conversation, late, false).await.unwrap();
    let reused = signer.link(rig.conversation, first, false).await.unwrap();

    assert_eq!(early, reused);
    assert!(matches!(joined, Link::Url(_)));
    assert_eq!(rig.world.urls_calls(), vec![vec![first], vec![late]]);
}

#[tokio::test]
async fn a_signed_url_is_reused_until_it_nearly_expires() {
    let rig = Rig::new();
    let media = rig.uploaded(41);
    rig.load(&media, Part::Image).await.unwrap();
    rig.cache.clear().unwrap();

    rig.load(&media, Part::Image).await.unwrap();

    assert_eq!(rig.world.urls_calls().len(), 1);
    assert_eq!(rig.world.gets_of(media.image_id), 2);
}

#[tokio::test]
async fn a_short_lived_url_is_not_reused() {
    let rig = Rig::new();
    rig.world.with(|state| state.expires_in_s = 30);
    let media = rig.uploaded(42);
    rig.load(&media, Part::Image).await.unwrap();
    rig.cache.clear().unwrap();

    rig.load(&media, Part::Image).await.unwrap();

    assert_eq!(rig.world.urls_calls().len(), 2);
}

#[tokio::test]
async fn misses_in_two_conversations_are_asked_apart() {
    let rig = Rig::new();
    let first = rig.uploaded(51);
    let second = rig.uploaded(52);
    let other = Uuid::new_v4();

    let (a, b) = tokio::join!(
        rig.load(&first, Part::Image),
        rig.downloads
            .fetch(other, second.attachment.clone(), Part::Image)
    );

    assert!(a.is_ok() && b.is_ok());
    assert_eq!(rig.world.urls_calls().len(), 2);
}

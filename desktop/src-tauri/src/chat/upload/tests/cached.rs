use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::time::Duration;

use sc_chat::ConversationKind;

use super::albums::sources;
use super::rig::{Rig, envelope};
use crate::chat::download::{Downloads, Fetched, Notice, Part};
use crate::network::edge::{Hop, Tier};

#[tokio::test(flavor = "multi_thread")]
async fn a_sent_image_and_its_thumb_open_from_the_cache_without_a_single_get() {
    let mut rig = Rig::new(ConversationKind::Group);
    rig.relays();
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(61)]))
        .await
        .unwrap();
    let album = views[0].album;
    rig.uploads
        .send_album(rig.post("cached"), album)
        .await
        .unwrap();
    rig.run();
    rig.until("the post", |rig| {
        rig.due().iter().any(|item| item.client_id == album)
    })
    .await;
    let item = rig
        .due()
        .into_iter()
        .find(|item| item.client_id == album)
        .unwrap();
    let attachment = envelope(&item).attachments[0].clone();
    let media_id = uuid::Uuid::parse_str(&attachment.media_id).unwrap();
    rig.ack(album);
    rig.until("the rows and files to go", |rig| {
        rig.uploads().is_empty() && rig.upload_files().is_empty()
    })
    .await;
    let calls = rig.world.with(|state| state.calls.len());
    let (origin, gets) = rig.answering(500, 0, Duration::ZERO);
    let notice: Notice = Arc::new(|_| {});
    let routes = Arc::new(move |_: &str| {
        vec![Hop {
            url: origin.clone(),
            tier: Tier::Relay,
            origin: String::new(),
        }]
    });
    let downloads = Arc::new(Downloads::routed(
        rig.uploads.api.clone(),
        rig.cache.clone(),
        notice,
        routes,
    ));
    for part in [Part::Image, Part::Thumb] {
        let fetched = downloads
            .fetch(rig.conversation, media_id, attachment.clone(), part)
            .await;
        assert!(matches!(fetched, Ok(Fetched::Image(_))));
    }
    assert_eq!(gets.load(Ordering::SeqCst), 0);
    assert_eq!(rig.world.with(|state| state.calls.len()), calls);
}

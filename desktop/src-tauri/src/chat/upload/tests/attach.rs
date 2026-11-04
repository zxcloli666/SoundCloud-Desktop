use sc_chat::{ChatError, ConversationKind};
use uuid::Uuid;

use super::albums::sources;
use super::png;
use super::rig::Rig;
use crate::chat::upload::attach::Source;

#[tokio::test(flavor = "multi_thread")]
async fn a_file_that_is_not_an_image_is_refused_and_leaves_nothing_behind() {
    let rig = Rig::new(ConversationKind::Group);
    let text = rig.dir.join("notes.txt");
    std::fs::write(&text, b"just words, not pixels").unwrap();
    let missing = rig.dir.join("gone.png");
    let refused = rig
        .uploads
        .attach(
            rig.conversation,
            None,
            vec![Source::Path(text), Source::Path(missing)],
        )
        .await;
    assert_eq!(refused.err(), Some(ChatError::Invalid));
    assert!(rig.uploads().is_empty());
    assert!(rig.upload_files().is_empty());
}

#[tokio::test(flavor = "multi_thread")]
async fn good_files_go_in_and_bad_ones_are_skipped() {
    let rig = Rig::new(ConversationKind::Group);
    let text = rig.dir.join("notes.txt");
    std::fs::write(&text, b"plain").unwrap();
    let views = rig
        .uploads
        .attach(
            rig.conversation,
            None,
            vec![Source::Path(rig.image(1).into()), Source::Path(text)],
        )
        .await
        .unwrap();
    assert_eq!(views.len(), 1);
    assert_eq!(rig.upload_files().len(), 2);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_room_album_stops_at_four_and_positions_continue_across_calls() {
    let rig = Rig::new(ConversationKind::Room);
    let first = rig
        .uploads
        .attach(
            rig.conversation,
            None,
            sources(vec![rig.image(1), rig.image(2), rig.image(3)]),
        )
        .await
        .unwrap();
    let album = first[0].album;
    let more = rig
        .uploads
        .attach(
            rig.conversation,
            Some(album),
            sources(vec![rig.image(4), rig.image(5)]),
        )
        .await
        .unwrap();
    assert_eq!(more.len(), 1);
    assert_eq!(more[0].position, 3);
    let full = rig
        .uploads
        .attach(rig.conversation, Some(album), sources(vec![rig.image(6)]))
        .await;
    assert_eq!(full.err(), Some(ChatError::Invalid));
    assert_eq!(rig.uploads().len(), 4);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_pasted_image_lands_like_a_file_and_an_album_cannot_hop_chats() {
    let rig = Rig::new(ConversationKind::Group);
    let pasted = rig
        .uploads
        .attach(
            rig.conversation,
            None,
            vec![Source::Data(png::noisy(320, 200, 9))],
        )
        .await
        .unwrap();
    assert_eq!(pasted.len(), 1);
    assert!(pasted[0].thumb_bytes > 0 && pasted[0].image_bytes % 4096 == 0);
    let elsewhere = rig
        .uploads
        .attach(
            Uuid::new_v4(),
            Some(pasted[0].album),
            vec![Source::Data(png::noisy(32, 32, 3))],
        )
        .await;
    assert_eq!(elsewhere.err(), Some(ChatError::NotFound));
    let empty = rig
        .uploads
        .attach(rig.conversation, None, vec![Source::Data(Vec::new())])
        .await;
    assert_eq!(empty.err(), Some(ChatError::Invalid));
}

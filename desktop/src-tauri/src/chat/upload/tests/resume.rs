use sc_chat::media::post_media;
use sc_chat::{ConversationKind, UploadObject, UploadState};
use serde_json::{Value, json};

use super::albums::sources;
use super::rig::{Path, Rig, envelope};
use crate::network::pro::fake_relay::{self, Kind};
use crate::network::pro::faulty_link::{self, Fault};

const CUT: usize = 16 * 1024;
const STAGED_BEFORE_CRASH: usize = 64 * 1024;

#[tokio::test(flavor = "multi_thread")]
async fn a_link_that_drops_every_16_kb_still_carries_the_album_through_pro_parts() {
    let mut rig = Rig::new(ConversationKind::Group);
    let relay = fake_relay::serve(Kind::Forwards);
    let cut_relay = faulty_link::link(&rig.world.s3, Fault::Cut(CUT)).await;
    let cut_pro = faulty_link::link(&relay.url, Fault::Cut(CUT)).await;
    rig.route(vec![Path::Relay(cut_relay), Path::Pro(cut_pro)]);
    let paths = vec![rig.image(11), rig.image(12)];
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(paths))
        .await
        .unwrap();
    let album = views[0].album;
    rig.uploads
        .send_album(rig.post("cut"), album)
        .await
        .unwrap();
    rig.run();
    rig.until("the album over a cut link", |rig| {
        rig.due().iter().any(|item| item.client_id == album)
    })
    .await;
    let item = rig
        .due()
        .into_iter()
        .find(|item| item.client_id == album)
        .unwrap();
    for image in post_media(&envelope(&item).attachments).unwrap() {
        assert_eq!(rig.world.puts_of(image), 1);
    }
    assert!(relay.parts() > 2 * (STAGED_BEFORE_CRASH / CUT));
}

#[tokio::test(flavor = "multi_thread")]
async fn a_restart_mid_album_resumes_the_stage_from_the_stored_part() {
    let rig = Rig::new(ConversationKind::Group);
    let relay = fake_relay::serve(Kind::Forwards);
    rig.route(vec![Path::Pro(relay.url.clone())]);
    let paths = vec![rig.image(21), rig.image(22)];
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(paths))
        .await
        .unwrap();
    let (album, first, second) = (views[0].album, views[0].id, views[1].id);
    rig.uploads
        .send_album(rig.post("resume"), album)
        .await
        .unwrap();
    while rig.store().upload(first).unwrap().unwrap().state != UploadState::Committed {
        let next = rig.store().next_upload().unwrap().unwrap();
        rig.uploads.step(next).await.unwrap();
    }
    let upload = rig.store().upload(second).unwrap().unwrap();
    rig.uploads.targets(&upload).await.unwrap();
    let upload = rig.store().upload(second).unwrap().unwrap();
    let image = std::fs::read(rig.dir.join("uploads").join(&upload.image_ref)).unwrap();
    let stage = stage_half(&relay.url, &image).await;
    let label = format!("{} {stage}", relay.url);
    rig.store()
        .upload_progress(
            second,
            UploadObject::Image,
            2,
            Some(&label),
            super::rig::START,
        )
        .unwrap();
    let parts_before = relay.parts();
    let opened_before = relay.stages_opened();

    let mut rig = rig.restart();
    rig.run();
    rig.until("the album after a restart", |rig| {
        rig.due().iter().any(|item| item.client_id == album)
    })
    .await;
    assert_eq!(relay.stages_opened(), opened_before + 1);
    let rest = (image.len() - STAGED_BEFORE_CRASH).div_ceil(32 * 1024);
    assert!(relay.parts() - parts_before <= rest + 1);
    let reserved = rig.world.reservation(second).unwrap();
    assert_eq!(rig.world.object(reserved.image).unwrap(), image);
    assert_eq!(
        rig.world
            .puts_of(rig.world.reservation(first).unwrap().image),
        1
    );
}

async fn stage_half(node: &str, body: &[u8]) -> String {
    let client = wreq::Client::new();
    let created: Value = client
        .post(format!("{node}/stage"))
        .json(&json!({"size": body.len()}))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let id = created["id"].as_str().unwrap().to_string();
    client
        .put(format!("{node}/stage/{id}?at=0"))
        .body(body[..STAGED_BEFORE_CRASH].to_vec())
        .send()
        .await
        .unwrap();
    id
}

#[tokio::test(flavor = "multi_thread")]
async fn an_expired_presign_reserves_again_with_the_same_ids() {
    let rig = Rig::new(ConversationKind::Group);
    rig.relays();
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(31)]))
        .await
        .unwrap();
    let id = views[0].id;
    let next = rig.store().next_upload().unwrap().unwrap();
    rig.uploads.step(next).await.unwrap();
    let first = rig.world.reservation(id).unwrap();
    rig.advance(600_000);
    let next = rig.store().next_upload().unwrap().unwrap();
    assert_eq!(next.object, UploadObject::Thumb);
    rig.uploads.step(next).await.unwrap();
    assert_eq!(rig.world.with(|state| state.reserves.clone()), [id, id]);
    let again = rig.world.reservation(id).unwrap();
    assert_eq!((again.image, again.thumb), (first.image, first.thumb));
    assert_eq!(rig.world.puts_of(first.image), 1);
    assert_eq!(rig.world.puts_of(first.thumb.unwrap()), 1);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_put_refused_as_expired_reserves_again_and_goes_through() {
    let mut rig = Rig::new(ConversationKind::Group);
    rig.relays();
    rig.world.with(|state| state.expire_puts = 1);
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(41)]))
        .await
        .unwrap();
    let id = views[0].id;
    rig.run();
    rig.until("the commit", |rig| {
        rig.uploads()
            .first()
            .is_some_and(|upload| upload.state == UploadState::Committed)
    })
    .await;
    assert_eq!(rig.world.with(|state| state.reserves.clone()), [id, id]);
    assert!(rig.host.errors.lock().unwrap().is_empty());
}

use super::super::open::placeholder;
use super::super::{Fetched, Part};
use super::rig::Rig;

#[tokio::test]
async fn a_thumbhash_draws_a_small_png() {
    let rig = Rig::new();
    let media = rig.media(71);

    let drawn = placeholder(media.attachment.thumbhash.clone()).await;

    let Fetched::Image(picture) = drawn else {
        panic!("no placeholder");
    };
    assert_eq!(picture.mime, "image/png");
    let decoded = image::load_from_memory(&picture.bytes).unwrap();
    assert!(decoded.width() > 0 && decoded.width() <= 32);
    assert!(decoded.height() > 0 && decoded.height() <= 32);
    assert_eq!(rig.cache.get(media.image_id, Part::Image).unwrap(), None);
}

#[tokio::test]
async fn a_broken_thumbhash_is_lost() {
    assert_eq!(placeholder(Vec::new()).await, Fetched::Lost);
    assert_eq!(placeholder(vec![1, 2]).await, Fetched::Lost);
    assert_eq!(placeholder(vec![0xff; 200]).await, Fetched::Lost);
}

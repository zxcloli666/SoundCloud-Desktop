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

#[derive(serde::Deserialize)]
struct Vector {
    name: String,
    hash: Vec<u8>,
    out: Drawn,
}

#[derive(serde::Deserialize)]
struct Drawn {
    w: u32,
    h: u32,
    rgba: String,
}

fn drawn(fetched: Fetched) -> image::RgbaImage {
    let Fetched::Image(picture) = fetched else {
        panic!("no placeholder");
    };
    image::load_from_memory(&picture.bytes)
        .unwrap()
        .into_rgba8()
}

#[tokio::test]
async fn reference_thumbhashes_draw_the_reference_pictures() {
    use base64::Engine;
    let vectors: Vec<Vector> =
        serde_json::from_str(include_str!("thumbhash-vectors.json")).unwrap();
    assert!(vectors.len() >= 8);

    for vector in vectors {
        let picture = drawn(placeholder(vector.hash).await);
        let expected = base64::engine::general_purpose::STANDARD
            .decode(&vector.out.rgba)
            .unwrap();
        assert_eq!(
            (picture.width(), picture.height()),
            (vector.out.w, vector.out.h),
            "{}",
            vector.name
        );
        assert!(picture.into_raw() == expected, "{} differs", vector.name);
    }
}

fn two_tone(width: u32, height: u32) -> Vec<u8> {
    use image::ImageEncoder;
    let pixels = image::RgbImage::from_fn(width, height, |x, _| match x < width / 2 {
        true => image::Rgb([230, 40, 40]),
        false => image::Rgb([30, 60, 220]),
    });
    let mut png = std::io::Cursor::new(Vec::new());
    image::codecs::png::PngEncoder::new(&mut png)
        .write_image(&pixels, width, height, image::ExtendedColorType::Rgb8)
        .unwrap();
    png.into_inner()
}

#[tokio::test]
async fn a_sent_picture_comes_back_as_its_own_blur() {
    let prepared = sc_chat::media::prepare_image(&two_tone(800, 400)).unwrap();

    let picture = drawn(placeholder(prepared.attachment.thumbhash).await);

    let (w, h) = (picture.width(), picture.height());
    assert_eq!(w, 32);
    assert!((h as f32 / w as f32 - 0.5).abs() < 0.1, "{w}x{h}");
    let left = picture.get_pixel(2, h / 2).0;
    let right = picture.get_pixel(w - 3, h / 2).0;
    assert!(left[0] > 150 && left[2] < 110, "left {left:?}");
    assert!(right[2] > 150 && right[0] < 110, "right {right:?}");
    assert_eq!((left[3], right[3]), (255, 255));
}

use sc_chat::ChatError;
use uuid::Uuid;

use super::{answer, parse};
use crate::chat::download::{Fetched, MediaKey, Picture, Variant};

const CONV: &str = "6f1c2a8e-4b1d-4c2e-9a3b-1d2e3f405162";
const MEDIA: &str = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

#[test]
fn every_variant_parses() {
    for (raw, variant) in [
        ("thumb", Variant::Thumb),
        ("image", Variant::Image),
        ("placeholder", Variant::Placeholder),
        ("upload-thumb", Variant::UploadThumb),
        ("upload-image", Variant::UploadImage),
    ] {
        assert_eq!(
            parse(&format!("/{CONV}/{MEDIA}/{raw}")),
            Some(MediaKey {
                conversation_id: Uuid::parse_str(CONV).unwrap(),
                media_id: Uuid::parse_str(MEDIA).unwrap(),
                variant,
            })
        );
    }
}

#[test]
fn a_bad_path_is_refused() {
    for path in [
        "",
        "/",
        &format!("/{CONV}/{MEDIA}"),
        &format!("/{CONV}/{MEDIA}/"),
        &format!("/{CONV}/{MEDIA}/full"),
        &format!("/{CONV}/{MEDIA}/thumb/"),
        &format!("/{CONV}/{MEDIA}/thumb/x"),
        &format!("{CONV}/{MEDIA}/thumb"),
        &format!("//{CONV}/{MEDIA}/thumb"),
        &format!("/{CONV}/not-a-uuid/thumb"),
        &format!("/{}/{MEDIA}/thumb", CONV.replace('-', "")),
        &format!("/{{{CONV}}}/{MEDIA}/thumb"),
        &format!("/urn:uuid:{CONV}/{MEDIA}/thumb"),
        &format!("/{CONV}/{MEDIA}/THUMB"),
        &format!("/../{MEDIA}/thumb"),
    ] {
        assert_eq!(parse(path), None, "{path}");
    }
}

fn status(loaded: Result<Fetched, ChatError>) -> (u16, String) {
    let response = answer(loaded);
    let cache = response
        .headers()
        .get("cache-control")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_owned();
    (response.status().as_u16(), cache)
}

#[test]
fn an_image_is_served_with_its_type_and_kept_privately() {
    let response = answer(Ok(Fetched::Image(Picture {
        bytes: vec![1, 2, 3],
        mime: "image/jpeg",
    })));

    assert_eq!(response.status().as_u16(), 200);
    assert_eq!(response.headers()["content-type"], "image/jpeg");
    assert_eq!(
        response.headers()["cache-control"],
        "private, max-age=86400"
    );
    assert_eq!(response.headers()["access-control-allow-origin"], "*");
    assert_eq!(response.body(), &vec![1, 2, 3]);
}

#[test]
fn every_failure_has_its_status_and_is_never_stored() {
    let cases = [
        (Ok(Fetched::Deleted), 410),
        (Ok(Fetched::Lost), 404),
        (Err(ChatError::NotFound), 404),
        (Err(ChatError::Invalid), 400),
        (Err(ChatError::NotReady), 503),
        (Err(ChatError::Store), 503),
        (Err(ChatError::Offline), 502),
        (Err(ChatError::Busy { retry_ms: 1000 }), 502),
        (Err(ChatError::ReadLimited), 502),
        (Err(ChatError::Internal), 502),
    ];
    for (loaded, code) in cases {
        let shown = format!("{loaded:?}");
        assert_eq!(status(loaded), (code, "no-store".to_owned()), "{shown}");
    }
}

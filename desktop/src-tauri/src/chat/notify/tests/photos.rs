use sc_chat::{AttachmentKind, ConversationKind, Message, MessageAttachment, PreviewMode};
use uuid::Uuid;

use super::super::alert::chat as alert;
use super::super::rules::Reason;
use super::super::strings::{LOCALES, get};
use super::fixtures::{chat, group, text};

fn with_photos(body: &str, count: u128) -> Message {
    let mut message = text(1, body);
    message.attachments = (0..count)
        .map(|at| MessageAttachment {
            media_id: Uuid::from_u128(100 + at),
            kind: AttachmentKind::Image,
            size: 4096,
            w: 1600,
            h: 1200,
            thumbhash: vec![1, 2, 3],
        })
        .collect();
    message
}

fn body(message: &Message, language: &str, sender: Option<&str>, mode: PreviewMode) -> String {
    let kind = match sender {
        Some(_) => group("Band"),
        None => chat(ConversationKind::Direct),
    };
    alert(&kind, message, Reason::Post, sender, mode, get(language)).body
}

#[test]
fn one_photo_without_text_says_photo() {
    let message = with_photos("", 1);
    assert_eq!(body(&message, "ru", None, PreviewMode::Full), "Фото");
    assert_eq!(body(&message, "en", None, PreviewMode::Full), "Photo");
    assert_eq!(body(&message, "ko", None, PreviewMode::Full), "사진");
    assert_eq!(body(&message, "tr", None, PreviewMode::Full), "Fotoğraf");
}

#[test]
fn an_album_without_text_counts_its_photos() {
    let message = with_photos("  \n ", 3);
    assert_eq!(body(&message, "ru", None, PreviewMode::Full), "3 фото");
    assert_eq!(body(&message, "en", None, PreviewMode::Full), "3 photos");
    assert_eq!(body(&message, "ko", None, PreviewMode::Full), "사진 3장");
    assert_eq!(body(&message, "tr", None, PreviewMode::Full), "3 fotoğraf");
}

#[test]
fn a_caption_wins_over_the_photo_count() {
    let message = with_photos("look at this", 4);
    assert_eq!(
        body(&message, "ru", None, PreviewMode::Full),
        "look at this"
    );
}

#[test]
fn a_group_photo_names_the_sender() {
    let message = with_photos("", 2);
    assert_eq!(
        body(&message, "ru", Some("Ann"), PreviewMode::Full),
        "Ann: 2 фото"
    );
}

#[test]
fn a_hidden_preview_does_not_tell_about_photos() {
    let message = with_photos("", 2);
    assert_eq!(
        body(&message, "ru", None, PreviewMode::NameOnly),
        get("ru").new_message
    );
}

#[test]
fn every_photo_template_keeps_the_count() {
    for (code, _) in LOCALES {
        assert!(get(code).photos.contains("{{count}}"), "{code}");
        assert!(!get(code).photo.contains("{{count}}"), "{code}");
    }
}

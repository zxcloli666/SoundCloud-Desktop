use sc_chat::{ChatPhase, ChatStatus};

use super::Badge;
use super::desktop_entry::app_uri;
use super::glyphs::{SIZE, render};

fn status(phase: ChatPhase, unread: u32, mentions: u32) -> ChatStatus {
    ChatStatus {
        phase,
        unread,
        mentions,
        ..ChatStatus::off()
    }
}

fn badge(unread: u32, mentions: u32) -> Badge {
    Badge::from_status(&status(ChatPhase::Ready, unread, mentions))
}

fn alpha(pixels: &[u8], x: u32, y: u32) -> u8 {
    pixels[((y * SIZE + x) * 4 + 3) as usize]
}

fn white(pixels: &[u8]) -> usize {
    pixels
        .chunks(4)
        .filter(|pixel| pixel == &[255, 255, 255, 255])
        .count()
}

#[test]
fn no_badge_without_a_ready_chat() {
    for phase in [
        ChatPhase::Off,
        ChatPhase::SignedOut,
        ChatPhase::Revoked,
        ChatPhase::BoundOther,
    ] {
        assert_eq!(Badge::from_status(&status(phase, 3, 1)), Badge::default());
    }
    assert_eq!(badge(0, 0).label(), None);
    assert_eq!(badge(0, 0).glyph(), None);
}

#[test]
fn the_badge_counts_unread_chats() {
    assert_eq!(badge(3, 0).label().as_deref(), Some("3"));
    assert_eq!(badge(150, 0).label().as_deref(), Some("99+"));
    assert_eq!(badge(3, 0).glyph().as_deref(), Some("3"));
    assert_eq!(badge(12, 0).glyph().as_deref(), Some("9+"));
}

#[test]
fn a_mention_turns_the_badge_into_the_at_variant() {
    assert_eq!(badge(3, 1).label().as_deref(), Some("@3"));
    assert_eq!(badge(3, 1).glyph().as_deref(), Some("@"));
    assert_eq!(badge(0, 2).label().as_deref(), Some("@2"));
}

#[test]
fn the_title_gets_a_prefix_only_with_unread() {
    assert_eq!(
        badge(0, 0).title("SoundCloud Desktop"),
        "SoundCloud Desktop"
    );
    assert_eq!(
        badge(4, 0).title("SoundCloud Desktop"),
        "(4) SoundCloud Desktop"
    );
    assert_eq!(
        badge(4, 2).title("SoundCloud Desktop"),
        "(@4) SoundCloud Desktop"
    );
}

#[test]
fn the_overlay_is_a_round_badge_with_ink() {
    let pixels = render("7");
    assert_eq!(pixels.len(), (SIZE * SIZE * 4) as usize);
    assert_eq!(alpha(&pixels, 0, 0), 0);
    assert_eq!(alpha(&pixels, SIZE - 1, SIZE - 1), 0);
    assert_eq!(alpha(&pixels, SIZE / 2, 1), 255);
    assert!(white(&pixels) > 0);
}

#[test]
fn every_badge_glyph_draws_inside_the_disc() {
    let blank = white(&render(""));
    assert_eq!(blank, 0);
    for text in ["1", "8", "9+", "@"] {
        let pixels = render(text);
        assert!(white(&pixels) > 0, "{text}");
        for y in 0..SIZE {
            for x in 0..SIZE {
                let at = ((y * SIZE + x) * 4) as usize;
                if pixels[at..at + 4] == [255, 255, 255, 255] {
                    let dx = x as f32 + 0.5 - SIZE as f32 / 2.0;
                    let dy = y as f32 + 0.5 - SIZE as f32 / 2.0;
                    assert!((dx * dx + dy * dy).sqrt() < 15.5, "{text} at {x},{y}");
                }
            }
        }
    }
    assert_eq!(render("123456789").len(), (SIZE * SIZE * 4) as usize);
}

#[test]
fn the_launcher_entry_follows_the_package() {
    assert_eq!(
        app_uri(
            Some("io.github.zxcloli666.SoundcloudDesktop"),
            None,
            "soundcloud-desktop"
        ),
        "application://io.github.zxcloli666.SoundcloudDesktop.desktop"
    );
    assert_eq!(
        app_uri(
            None,
            Some("/usr/share/applications/soundcloud-desktop-bin.desktop"),
            "soundcloud-desktop"
        ),
        "application://soundcloud-desktop-bin.desktop"
    );
    assert_eq!(
        app_uri(
            Some(" "),
            Some("/tmp/not-a-desktop-file"),
            "soundcloud-desktop"
        ),
        "application://soundcloud-desktop.desktop"
    );
}

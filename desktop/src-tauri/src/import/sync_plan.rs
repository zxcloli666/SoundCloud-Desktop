use std::collections::HashSet;

use super::model::ExtTrack;
use super::request::Request;
use super::source::{Source, detect};
use super::ym_link::YmRef;
use super::youtube::YtRef;

pub fn syncable(request: &Request) -> bool {
    match request {
        Request::YmLikes { .. } | Request::YmPlaylist { .. } => true,
        Request::Text { .. } => false,
        Request::Link { url, .. } => match detect(url) {
            Some(Source::Spotify(source)) => source.kind == "playlist",
            Some(Source::YouTube(source)) => matches!(source, YtRef::Playlist(_)),
            Some(Source::Yandex(source)) => {
                matches!(source, YmRef::UserPlaylist { .. } | YmRef::Playlist { .. })
            }
            None => false,
        },
    }
}

pub fn key(track: &ExtTrack) -> String {
    let text = format!(
        "{}\u{1f}{}",
        track.artist.trim().to_lowercase(),
        track.title.trim().to_lowercase()
    );
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in text.bytes() {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

pub fn fresh<'a>(tracks: &'a [ExtTrack], seen: &HashSet<String>) -> Vec<&'a ExtTrack> {
    let mut taken = HashSet::new();
    tracks
        .iter()
        .filter(|track| {
            let key = key(track);
            !seen.contains(&key) && taken.insert(key)
        })
        .collect()
}

pub struct Ledger {
    pub added: Vec<String>,
    pub latest: Vec<String>,
    pub removed: Vec<String>,
}

pub fn reconcile(ledger: Ledger, current: &HashSet<String>) -> Ledger {
    let mut removed = ledger.removed;
    let mut known: HashSet<String> = removed.iter().cloned().collect();
    let mut added = Vec::new();
    for urn in ledger.added {
        if current.contains(&urn) {
            added.push(urn);
        } else if known.insert(urn.clone()) {
            removed.push(urn);
        }
    }
    for urn in ledger.latest {
        if current.contains(&urn) && !added.contains(&urn) {
            added.push(urn);
        }
    }
    Ledger {
        added,
        latest: Vec::new(),
        removed,
    }
}

pub fn appendable(
    matched: impl IntoIterator<Item = Option<String>>,
    ledger: &Ledger,
    current: &HashSet<String>,
) -> Vec<String> {
    let mut taken: HashSet<&str> = ledger.removed.iter().map(String::as_str).collect();
    taken.extend(current.iter().map(String::as_str));
    let mut out: Vec<String> = Vec::new();
    for urn in matched.into_iter().flatten() {
        if !taken.contains(urn.as_str()) && !out.contains(&urn) {
            out.push(urn);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track(artist: &str, title: &str) -> ExtTrack {
        ExtTrack {
            artist: artist.into(),
            title: title.into(),
            duration_ms: None,
        }
    }

    fn set(items: &[&str]) -> HashSet<String> {
        items.iter().map(|item| item.to_string()).collect()
    }

    fn urns(items: &[&str]) -> Vec<String> {
        items.iter().map(|item| item.to_string()).collect()
    }

    fn ledger(added: &[&str], latest: &[&str], removed: &[&str]) -> Ledger {
        Ledger {
            added: urns(added),
            latest: urns(latest),
            removed: urns(removed),
        }
    }

    #[test]
    fn key_ignores_case_and_spaces() {
        assert_eq!(
            key(&track(" Daft Punk", "One More Time ")),
            key(&track("daft punk", "one more time"))
        );
        assert_ne!(key(&track("a", "b")), key(&track("b", "a")));
    }

    #[test]
    fn fresh_skips_seen_and_repeats_inside_the_list() {
        let tracks = vec![
            track("A", "One"),
            track("B", "Two"),
            track("a", "one"),
            track("C", "Three"),
        ];
        let seen = set(&[&key(&track("B", "Two"))]);
        let labels: Vec<String> = fresh(&tracks, &seen).iter().map(|t| t.label()).collect();
        assert_eq!(labels, vec!["A - One", "C - Three"]);
    }

    #[test]
    fn a_urn_removed_by_the_user_is_marked_and_never_returns() {
        let current = set(&["soundcloud:tracks:1"]);
        let next = reconcile(
            ledger(&["soundcloud:tracks:1", "soundcloud:tracks:2"], &[], &[]),
            &current,
        );
        assert_eq!(next.removed, urns(&["soundcloud:tracks:2"]));
        assert_eq!(next.added, urns(&["soundcloud:tracks:1"]));

        let matched = vec![
            Some("soundcloud:tracks:2".to_string()),
            Some("soundcloud:tracks:3".to_string()),
        ];
        let out = appendable(matched, &next, &current);
        assert_eq!(out, urns(&["soundcloud:tracks:3"]));
    }

    #[test]
    fn removed_stays_removed_when_the_track_is_back_in_the_list_of_added() {
        let current = set(&[]);
        let first = reconcile(ledger(&["soundcloud:tracks:2"], &[], &[]), &current);
        let second = reconcile(ledger(&[], &[], &["soundcloud:tracks:2"]), &current);
        assert_eq!(first.removed, second.removed);
        let again = reconcile(
            ledger(&["soundcloud:tracks:2"], &[], &["soundcloud:tracks:2"]),
            &current,
        );
        assert_eq!(again.removed, urns(&["soundcloud:tracks:2"]));
    }

    #[test]
    fn nothing_is_appended_twice() {
        let current = set(&["soundcloud:tracks:1"]);
        let none = ledger(&[], &[], &[]);
        let matched = vec![
            Some("soundcloud:tracks:1".to_string()),
            Some("soundcloud:tracks:4".to_string()),
            None,
            Some("soundcloud:tracks:4".to_string()),
        ];
        assert_eq!(
            appendable(matched, &none, &current),
            urns(&["soundcloud:tracks:4"])
        );
    }

    #[test]
    fn tracks_just_appended_get_one_sync_of_grace() {
        let lagging = reconcile(ledger(&[], &["soundcloud:tracks:5"], &[]), &set(&[]));
        assert!(lagging.removed.is_empty());
        assert!(lagging.added.is_empty());
        let landed = reconcile(
            ledger(&[], &["soundcloud:tracks:5"], &[]),
            &set(&["soundcloud:tracks:5"]),
        );
        assert_eq!(landed.added, urns(&["soundcloud:tracks:5"]));
    }

    #[test]
    fn only_changing_sources_can_sync() {
        let link = |url: &str| Request::Link {
            url: url.into(),
            token: None,
        };
        assert!(syncable(&link(
            "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
        )));
        assert!(!syncable(&link(
            "https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy"
        )));
        assert!(!syncable(&link(
            "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"
        )));
        assert!(syncable(&link(
            "https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI"
        )));
        assert!(!syncable(&link("https://youtu.be/dQw4w9WgXcQ")));
        assert!(!syncable(&link("https://music.yandex.ru/album/3389008")));
        assert!(!syncable(&Request::Text {
            text: "A - B".into()
        }));
        assert!(syncable(&Request::YmLikes { token: "t".into() }));
    }
}

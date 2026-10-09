const TRACK_URN_PREFIX: &str = "soundcloud:tracks:";
const TRACK_STORAGE_PREFIX: &str = "soundcloud_tracks_";

fn canonical_id(raw: &str) -> Option<&str> {
    let valid = !raw.starts_with('0')
        && raw.bytes().all(|byte| byte.is_ascii_digit())
        && raw.parse::<i64>().is_ok();
    valid.then_some(raw)
}

fn track_urn_of(id: &str) -> Option<String> {
    canonical_id(id).map(|id| format!("{TRACK_URN_PREFIX}{id}"))
}

pub fn canonical_track_urn(raw: &str) -> Option<String> {
    let raw = raw.trim();
    match raw.strip_prefix(TRACK_URN_PREFIX) {
        Some(id) => track_urn_of(id),
        None if raw.contains(':') => None,
        None => track_urn_of(raw),
    }
}

pub fn track_id(urn: &str) -> Option<&str> {
    urn.strip_prefix(TRACK_URN_PREFIX).and_then(canonical_id)
}

pub fn track_urn_from_storage_name(name: &str) -> Option<String> {
    name.strip_prefix(TRACK_STORAGE_PREFIX)
        .and_then(track_urn_of)
}

#[cfg(test)]
mod tests {
    use super::{canonical_track_urn, track_id, track_urn_from_storage_name};

    #[test]
    fn bare_ids_and_track_urns_meet_in_one_canonical_urn() {
        for raw in [
            "42",
            " 42 ",
            "soundcloud:tracks:42",
            " soundcloud:tracks:42",
        ] {
            assert_eq!(
                canonical_track_urn(raw).as_deref(),
                Some("soundcloud:tracks:42"),
                "{raw:?}"
            );
        }
        assert!(canonical_track_urn("9223372036854775807").is_some());
    }

    #[test]
    fn anything_but_a_track_id_is_rejected() {
        for raw in [
            "",
            "0",
            "042",
            "-4",
            "+4",
            "4a",
            "soundcloud:tracks:",
            "soundcloud:tracks:0",
            "soundcloud:tracks:042",
            "soundcloud:tracks:5:6",
            "soundcloud:users:5",
            "soundcloud:playlists:5",
            "tracks:5",
            "soundcloud_tracks_5",
            "9223372036854775808",
        ] {
            assert_eq!(canonical_track_urn(raw), None, "{raw:?}");
        }
    }

    #[test]
    fn track_id_reads_only_a_canonical_track_urn() {
        assert_eq!(track_id("soundcloud:tracks:42"), Some("42"));
        assert_eq!(track_id("42"), None);
        assert_eq!(track_id("soundcloud:users:42"), None);
        assert_eq!(track_id("soundcloud:tracks:042"), None);
    }

    #[test]
    fn storage_names_decode_only_canonical_track_names() {
        assert_eq!(
            track_urn_from_storage_name("soundcloud_tracks_42").as_deref(),
            Some("soundcloud:tracks:42")
        );
        for name in [
            "42",
            "soundcloud_tracks_042",
            "soundcloud_tracks_",
            "soundcloud_users_42",
            "soundcloud_tracks_42_x",
            "foo_bar",
        ] {
            assert_eq!(track_urn_from_storage_name(name), None, "{name:?}");
        }
    }
}

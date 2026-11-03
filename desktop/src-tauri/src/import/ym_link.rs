use super::source::parse_url;

#[derive(Debug, PartialEq)]
pub enum YmRef {
    UserPlaylist { owner: String, kind: String },
    Playlist { uuid: String },
    Album { id: String },
    Track { id: String },
}

pub fn parse(input: &str) -> Option<YmRef> {
    let url = parse_url(input)?;
    if !url
        .host_str()?
        .to_ascii_lowercase()
        .contains("music.yandex.")
    {
        return None;
    }
    let parts: Vec<&str> = url.path().trim_matches('/').split('/').collect();
    let at = |i: usize| parts.get(i).map(|part| part.to_string());
    match parts.as_slice() {
        ["users", _, "playlists", _, ..] => Some(YmRef::UserPlaylist {
            owner: at(1)?,
            kind: at(3)?,
        }),
        ["playlists", _, ..] => Some(YmRef::Playlist { uuid: at(1)? }),
        ["album", _, "track", _, ..] => Some(YmRef::Track { id: at(3)? }),
        ["album", _, ..] => Some(YmRef::Album { id: at(1)? }),
        ["track", _, ..] => Some(YmRef::Track { id: at(1)? }),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{YmRef, parse};

    #[test]
    fn reads_every_link_shape() {
        assert_eq!(
            parse("https://music.yandex.ru/users/ya.playlist/playlists/1234"),
            Some(YmRef::UserPlaylist {
                owner: "ya.playlist".into(),
                kind: "1234".into()
            })
        );
        assert_eq!(
            parse("music.yandex.com/playlists/lk.abc-123"),
            Some(YmRef::Playlist {
                uuid: "lk.abc-123".into()
            })
        );
        assert_eq!(
            parse("https://music.yandex.ru/album/9/track/7"),
            Some(YmRef::Track { id: "7".into() })
        );
        assert_eq!(
            parse("https://music.yandex.ru/album/9"),
            Some(YmRef::Album { id: "9".into() })
        );
        assert_eq!(parse("https://music.yandex.ru/home"), None);
    }
}

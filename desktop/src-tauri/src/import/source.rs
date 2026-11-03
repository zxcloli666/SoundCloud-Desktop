use super::spotify::{self, SpotifyRef};
use super::ym_link::{self, YmRef};
use super::youtube::{self, YtRef};

pub enum Source {
    Spotify(SpotifyRef),
    Yandex(YmRef),
    YouTube(YtRef),
}

impl Source {
    pub fn label(&self) -> &'static str {
        match self {
            Source::Spotify(_) => "spotify",
            Source::Yandex(_) => "yandex",
            Source::YouTube(_) => "youtube",
        }
    }
}

pub fn parse_url(input: &str) -> Option<url::Url> {
    let raw = input.trim();
    if raw.contains(char::is_whitespace) {
        return None;
    }
    let full = if raw.contains("://") {
        raw.to_string()
    } else {
        format!("https://{raw}")
    };
    url::Url::parse(&full).ok()
}

pub fn detect(input: &str) -> Option<Source> {
    youtube::parse(input)
        .map(Source::YouTube)
        .or_else(|| spotify::parse(input).map(Source::Spotify))
        .or_else(|| ym_link::parse(input).map(Source::Yandex))
}

#[cfg(test)]
mod tests {
    use super::detect;

    fn label(input: &str) -> Option<&'static str> {
        detect(input).map(|source| source.label())
    }

    #[test]
    fn links_pick_their_source() {
        assert_eq!(
            label("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=1"),
            Some("spotify")
        );
        assert_eq!(
            label("spotify:album:4aawyAB9vmqN3uQ7FjRGTy"),
            Some("spotify")
        );
        assert_eq!(
            label("https://music.yandex.ru/album/123/track/456"),
            Some("yandex")
        );
        assert_eq!(
            label("https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"),
            Some("youtube")
        );
        assert_eq!(label("https://youtu.be/dQw4w9WgXcQ"), Some("youtube"));
        assert_eq!(label("Artist - Title"), None);
        assert_eq!(label("https://example.com/x"), None);
    }
}

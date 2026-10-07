use super::snapshot::NowPlaying;

pub const DEFAULT_TEMPLATE: &str = "{artist} - {title}";

pub fn render(template: &str, np: &NowPlaying) -> String {
    if !np.has_track {
        return String::new();
    }
    let template = if template.trim().is_empty() {
        DEFAULT_TEMPLATE
    } else {
        template
    };
    template
        .replace("{artist}", np.artist.trim())
        .replace("{title}", np.title.trim())
        .replace("\\n", "\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track() -> NowPlaying {
        NowPlaying {
            has_track: true,
            title: "Midnight City".into(),
            artist: "M83".into(),
            ..NowPlaying::default()
        }
    }

    #[test]
    fn fills_artist_and_title() {
        assert_eq!(
            render("{artist} - {title}", &track()),
            "M83 - Midnight City"
        );
        assert_eq!(
            render("♪ {title} ({artist})", &track()),
            "♪ Midnight City (M83)"
        );
    }

    #[test]
    fn falls_back_to_default_template() {
        assert_eq!(render("  ", &track()), "M83 - Midnight City");
    }

    #[test]
    fn supports_line_breaks() {
        assert_eq!(render("{title}\\n{artist}", &track()), "Midnight City\nM83");
    }

    #[test]
    fn empty_without_track() {
        assert_eq!(render("{artist} - {title}", &NowPlaying::default()), "");
    }
}

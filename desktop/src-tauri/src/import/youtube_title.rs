use super::model::ExtTrack;

const NOISE: [&str; 17] = [
    "official",
    "oficial",
    "video",
    "audio",
    "lyrics",
    "lyric",
    "visualizer",
    "visualiser",
    "mv",
    "hd",
    "hq",
    "4k",
    "clip",
    "\u{43a}\u{43b}\u{438}\u{43f}",
    "\u{43f}\u{440}\u{435}\u{43c}\u{44c}\u{435}\u{440}\u{430}",
    "\u{442}\u{435}\u{43a}\u{441}\u{442}",
    "m/v",
];
const BRACKETS: [(char, char); 3] = [('(', ')'), ('[', ']'), ('\u{3010}', '\u{3011}')];
const DASHES: [char; 3] = ['-', '\u{2013}', '\u{2014}'];
const QUOTES: [char; 5] = ['"', '\'', '\u{ab}', '\u{bb}', ' '];

pub fn to_track(video_title: &str, channel: &str, duration_ms: Option<u64>) -> ExtTrack {
    let author = clean_channel(channel);
    let cleaned = strip_trailer(&strip_noise(video_title)).trim().to_string();
    let (artist, title) = match split_artist(&cleaned) {
        Some((artist, title)) if !artist.is_empty() => (artist.to_string(), title.to_string()),
        _ => (author, cleaned.clone()),
    };
    let title = title.trim_matches(QUOTES).trim().to_string();
    ExtTrack {
        artist,
        title: if title.is_empty() {
            video_title.trim().to_string()
        } else {
            title
        },
        duration_ms,
    }
}

fn has_suffix(text: &str, suffix: &str) -> bool {
    let skip = text.chars().count().saturating_sub(suffix.chars().count());
    text.chars()
        .skip(skip)
        .collect::<String>()
        .eq_ignore_ascii_case(suffix)
}

fn cut_chars(text: &str, count: usize) -> &str {
    let keep = text.chars().count().saturating_sub(count);
    let end = text
        .char_indices()
        .nth(keep)
        .map_or(text.len(), |(at, _)| at);
    text[..end].trim_end()
}

fn clean_channel(channel: &str) -> String {
    let mut name = channel.trim();
    if has_suffix(name, "topic") {
        name = cut_chars(name, "topic".len())
            .trim_end_matches(DASHES)
            .trim_end();
    }
    for word in ["vevo", "official"] {
        if has_suffix(name, word) {
            name = cut_chars(name, word.len());
        }
    }
    name.to_string()
}

fn is_noisy(inside: &str) -> bool {
    let lower = inside.to_lowercase();
    lower.contains("m/v")
        || lower
            .split(|c: char| !c.is_alphanumeric())
            .any(|word| NOISE.contains(&word))
}

fn strip_noise(title: &str) -> String {
    let mut out = String::new();
    let mut chars = title.char_indices();
    while let Some((at, c)) = chars.next() {
        let closing = BRACKETS
            .iter()
            .find(|(open, _)| *open == c)
            .map(|(_, close)| *close);
        let end = closing.and_then(|close| title[at..].find(close).map(|i| at + i));
        match end {
            Some(end) if is_noisy(&title[at + c.len_utf8()..end]) => {
                out.truncate(out.trim_end().len());
                for _ in title[at..=end].chars().skip(1) {
                    chars.next();
                }
            }
            _ => out.push(c),
        }
    }
    out
}

fn strip_trailer(title: &str) -> &str {
    title.split(['|', '\u{ff5c}']).next().unwrap_or(title)
}

fn split_artist(title: &str) -> Option<(&str, &str)> {
    let chars: Vec<(usize, char)> = title.char_indices().collect();
    chars.windows(3).find_map(|w| {
        let spaced = w[0].1.is_whitespace() && DASHES.contains(&w[1].1) && w[2].1.is_whitespace();
        spaced.then(|| (title[..w[0].0].trim(), title[w[2].0..].trim()))
    })
}

#[cfg(test)]
mod tests {
    use super::to_track;

    fn pair(title: &str, channel: &str) -> (String, String) {
        let track = to_track(title, channel, None);
        (track.artist, track.title)
    }

    fn expect(artist: &str, title: &str) -> (String, String) {
        (artist.to_string(), title.to_string())
    }

    #[test]
    fn splits_artist_and_drops_noise() {
        assert_eq!(
            pair("Boris Brejcha - Gravity (Official Video)", "Boris Brejcha"),
            expect("Boris Brejcha", "Gravity")
        );
        assert_eq!(
            pair(
                "Skrillex \u{2013} Bangarang [Lyric Video] | Atlantic",
                "Skrillex VEVO"
            ),
            expect("Skrillex", "Bangarang")
        );
        assert_eq!(
            pair(
                "\u{41c}\u{43e}\u{440}\u{433}\u{435}\u{43d}\u{448}\u{442}\u{435}\u{440}\u{43d} - \u{41a}\u{43e}\u{43b}\u{43b}\u{430}\u{43d} (\u{41a}\u{43b}\u{438}\u{43f}, 2020)",
                "x"
            ),
            expect(
                "\u{41c}\u{43e}\u{440}\u{433}\u{435}\u{43d}\u{448}\u{442}\u{435}\u{440}\u{43d}",
                "\u{41a}\u{43e}\u{43b}\u{43b}\u{430}\u{43d}"
            )
        );
    }

    #[test]
    fn channel_is_the_artist_without_a_dash_and_keeps_real_brackets() {
        assert_eq!(
            pair("Numb (Live at Wembley)", "Linkin Park - Topic"),
            expect("Linkin Park", "Numb (Live at Wembley)")
        );
        assert_eq!(
            pair("\"Gravity\"", "Boris Brejcha Official"),
            expect("Boris Brejcha", "Gravity")
        );
    }
}

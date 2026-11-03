use super::failure::{Failure, SOURCE_EMPTY};
use super::model::{ExtList, ExtTrack};

const DASHES: [char; 3] = ['-', '\u{2013}', '\u{2014}'];

pub fn parse(text: &str) -> Result<ExtList, Failure> {
    let tracks: Vec<ExtTrack> = text
        .lines()
        .map(strip_numbering)
        .filter(|line| !line.is_empty())
        .filter_map(split_line)
        .collect();
    let tracks = drop_header(tracks);
    if tracks.is_empty() {
        return Err(Failure::new(SOURCE_EMPTY, "no lines"));
    }
    Ok(ExtList {
        title: String::new(),
        tracks,
        partial: false,
    })
}

fn drop_header(mut tracks: Vec<ExtTrack>) -> Vec<ExtTrack> {
    let header = tracks.first().is_some_and(|track| {
        track.artist.eq_ignore_ascii_case("artist") && track.title.eq_ignore_ascii_case("title")
    });
    if header {
        tracks.remove(0);
    }
    tracks
}

fn strip_numbering(line: &str) -> &str {
    let line = line
        .trim()
        .trim_start_matches(['\u{2022}', '*'])
        .trim_start();
    let digits = line.bytes().take_while(u8::is_ascii_digit).count();
    let rest = &line[digits..];
    let numbered = digits > 0
        && digits <= 4
        && rest.starts_with(['.', ')'])
        && rest[1..].starts_with(char::is_whitespace);
    if numbered {
        rest[1..].trim_start()
    } else {
        line
    }
}

fn split_line(line: &str) -> Option<ExtTrack> {
    let (artist, title) = split_tab(line)
        .or_else(|| split_dash(line))
        .or_else(|| split_csv(line))
        .unwrap_or(("", line));
    let artist = artist.trim().trim_matches('"').trim();
    let title = title.trim().trim_matches('"').trim();
    if title.is_empty() && artist.is_empty() {
        return None;
    }
    Some(ExtTrack {
        artist: artist.to_string(),
        title: title.to_string(),
        duration_ms: None,
    })
}

fn split_tab(line: &str) -> Option<(&str, &str)> {
    line.split_once('\t')
        .map(|(artist, rest)| (artist, rest.split('\t').next().unwrap_or(rest)))
}

fn split_dash(line: &str) -> Option<(&str, &str)> {
    let chars: Vec<(usize, char)> = line.char_indices().collect();
    chars.windows(3).find_map(|w| {
        let spaced = w[0].1.is_whitespace() && DASHES.contains(&w[1].1) && w[2].1.is_whitespace();
        spaced.then(|| (&line[..w[0].0], &line[w[2].0..]))
    })
}

fn split_csv(line: &str) -> Option<(&str, &str)> {
    if let Some(rest) = line.strip_prefix('"') {
        let (artist, tail) = rest.split_once('"')?;
        let title = tail.strip_prefix(',')?;
        return Some((artist, title.split(',').next().unwrap_or(title)));
    }
    let (artist, rest) = line.split_once(',')?;
    Some((artist, rest.split(',').next().unwrap_or(rest)))
}

#[cfg(test)]
mod tests {
    use super::parse;

    fn pairs(text: &str) -> Vec<(String, String)> {
        parse(text)
            .unwrap()
            .tracks
            .into_iter()
            .map(|track| (track.artist, track.title))
            .collect()
    }

    fn pair(artist: &str, title: &str) -> (String, String) {
        (artist.to_string(), title.to_string())
    }

    #[test]
    fn reads_dashes_tabs_and_csv() {
        let text = "Boris Brejcha - Gravity\nSkrillex \u{2014} Bangarang\n1. Daft Punk \u{2013} One More Time\nMoby\tPorcelain\nLinkin Park,Numb\n\"Earth, Wind & Fire\",September\n";
        assert_eq!(
            pairs(text),
            vec![
                pair("Boris Brejcha", "Gravity"),
                pair("Skrillex", "Bangarang"),
                pair("Daft Punk", "One More Time"),
                pair("Moby", "Porcelain"),
                pair("Linkin Park", "Numb"),
                pair("Earth, Wind & Fire", "September"),
            ]
        );
    }

    #[test]
    fn dashes_inside_words_do_not_split() {
        assert_eq!(
            pairs("Jay-Z - Run This Town"),
            vec![pair("Jay-Z", "Run This Town")]
        );
        assert_eq!(pairs("Only A Title"), vec![pair("", "Only A Title")]);
    }

    #[test]
    fn header_and_blank_lines_are_skipped() {
        assert_eq!(
            pairs("artist,title\n\nMoby,Porcelain\n  \n"),
            vec![pair("Moby", "Porcelain")]
        );
        assert!(parse(" \n\n").is_err());
    }
}

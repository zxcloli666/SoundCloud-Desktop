use std::collections::HashSet;

use super::model::ExtTrack;
use super::text::{split_line, strip_numbering};

enum Line<'a> {
    Blank,
    Duration(u64),
    Marker,
    Index(&'a str),
    Text(&'a str),
}

struct Row<'a> {
    lines: Vec<&'a str>,
    duration_ms: Option<u64>,
}

pub fn parse(text: &str) -> Option<Vec<ExtTrack>> {
    let lines: Vec<Line> = text.lines().map(classify).collect();
    let rows = by_duration(&lines)
        .or_else(|| by_index(&lines))
        .or_else(|| by_blocks(&lines))?;
    let tracks = build(rows);
    (!tracks.is_empty()).then_some(tracks)
}

fn classify(line: &str) -> Line<'_> {
    let line = line.trim();
    if line.is_empty() {
        return Line::Blank;
    }
    if let Some(ms) = duration(line) {
        return Line::Duration(ms);
    }
    if matches!(line, "E" | "\u{415}" | "\u{1F174}" | "18+") {
        return Line::Marker;
    }
    if line.len() <= 4 && line.bytes().all(|b| b.is_ascii_digit()) {
        return Line::Index(line);
    }
    Line::Text(line)
}

pub(super) fn duration(line: &str) -> Option<u64> {
    let parts: Vec<&str> = line.split(':').collect();
    if !(2..=3).contains(&parts.len()) {
        return None;
    }
    let mut seconds = 0u64;
    for (i, part) in parts.iter().enumerate() {
        if part.is_empty() || part.len() > 2 || !part.bytes().all(|b| b.is_ascii_digit()) {
            return None;
        }
        let value: u64 = part.parse().ok()?;
        if i > 0 && value >= 60 {
            return None;
        }
        seconds = seconds * 60 + value;
    }
    Some(seconds * 1000)
}

fn by_duration<'a>(lines: &[Line<'a>]) -> Option<Vec<Row<'a>>> {
    if !lines.iter().any(|line| matches!(line, Line::Duration(_))) {
        return None;
    }
    let mut rows = Vec::new();
    let mut current = Vec::new();
    for line in lines {
        match line {
            Line::Text(text) | Line::Index(text) => current.push(*text),
            Line::Duration(ms) => rows.push(Row {
                lines: std::mem::take(&mut current),
                duration_ms: Some(*ms),
            }),
            Line::Blank | Line::Marker => {}
        }
    }
    Some(rows)
}

fn by_index<'a>(lines: &[Line<'a>]) -> Option<Vec<Row<'a>>> {
    let numbers: Vec<u32> = lines
        .iter()
        .filter_map(|line| match line {
            Line::Index(text) => text.parse().ok(),
            _ => None,
        })
        .collect();
    let ascending = numbers.len() >= 3 && numbers.windows(2).all(|w| w[1] == w[0] + 1);
    if !ascending {
        return None;
    }
    let mut rows: Vec<Row> = Vec::new();
    for line in lines {
        match line {
            Line::Index(_) => rows.push(Row {
                lines: Vec::new(),
                duration_ms: None,
            }),
            Line::Text(text) => {
                if let Some(row) = rows.last_mut() {
                    row.lines.push(text);
                }
            }
            _ => {}
        }
    }
    Some(rows)
}

fn by_blocks<'a>(lines: &[Line<'a>]) -> Option<Vec<Row<'a>>> {
    let mut rows: Vec<Row> = Vec::new();
    let mut open = false;
    for line in lines {
        match line {
            Line::Blank => open = false,
            Line::Text(text) | Line::Index(text) => {
                if !open {
                    rows.push(Row {
                        lines: Vec::new(),
                        duration_ms: None,
                    });
                    open = true;
                }
                rows.last_mut()?.lines.push(text);
            }
            _ => {}
        }
    }
    let stacked = rows.len() >= 2
        && rows
            .iter()
            .all(|row| row.lines.len() == 2 && !row.lines.iter().any(|l| has_separator(l)));
    stacked.then_some(rows)
}

fn has_separator(line: &str) -> bool {
    line.contains('\t')
        || line.contains(" - ")
        || line.contains(" \u{2013} ")
        || line.contains(" \u{2014} ")
}

fn is_dash(line: &str) -> bool {
    matches!(line, "-" | "\u{2013}" | "\u{2014}")
}

fn is_continuation(line: &str) -> bool {
    let lower = line.to_lowercase();
    lower.starts_with("feat.")
        || lower.starts_with("feat ")
        || lower.starts_with("ft.")
        || lower.starts_with('(')
        || lower.starts_with('[')
}

fn merge_continuations<'a>(lines: &[&'a str]) -> Vec<String> {
    let mut merged: Vec<String> = Vec::new();
    for line in lines {
        match merged.last_mut() {
            Some(previous) if is_continuation(line) => {
                previous.push(' ');
                previous.push_str(line);
            }
            _ => merged.push((*line).to_string()),
        }
    }
    merged
}

struct Fields {
    first: String,
    second: String,
    artist_first: bool,
    duration_ms: Option<u64>,
}

fn fields(row: &Row) -> Option<Fields> {
    let mut lines = row.lines.clone();
    if lines.len() >= 3 && lines[0].bytes().all(|b| b.is_ascii_digit()) {
        lines.remove(0);
    }
    let dashed = lines.iter().any(|line| is_dash(line));
    let mut merged = merge_continuations(
        &lines
            .into_iter()
            .filter(|l| !is_dash(l))
            .collect::<Vec<_>>(),
    );
    let n = merged.len();
    if n == 0 {
        return None;
    }
    if n == 1 {
        let line = strip_numbering(&merged[0]).to_string();
        let track = split_line(&line)?;
        return Some(Fields {
            first: track.artist,
            second: track.title,
            artist_first: true,
            duration_ms: row.duration_ms,
        });
    }
    let second = merged.pop()?;
    let first = merged.pop()?;
    Some(Fields {
        first,
        second,
        artist_first: dashed,
        duration_ms: row.duration_ms,
    })
}

fn build(rows: Vec<Row>) -> Vec<ExtTrack> {
    let all: Vec<Fields> = rows.iter().filter_map(fields).collect();
    let stacked: Vec<&Fields> = all.iter().filter(|f| !f.artist_first).collect();
    let firsts: HashSet<&str> = stacked.iter().map(|f| f.first.as_str()).collect();
    let seconds: HashSet<&str> = stacked.iter().map(|f| f.second.as_str()).collect();
    let artist_on_top = firsts.len() < seconds.len();
    all.into_iter()
        .map(|f| {
            let swap = !f.artist_first && !artist_on_top;
            let (artist, title) = if swap {
                (f.second, f.first)
            } else {
                (f.first, f.second)
            };
            ExtTrack {
                artist,
                title,
                duration_ms: f.duration_ms,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::super::text::{parse, preview};

    fn rows(text: &str) -> Vec<(String, String, Option<u64>)> {
        parse(text)
            .unwrap()
            .tracks
            .into_iter()
            .map(|t| (t.artist, t.title, t.duration_ms))
            .collect()
    }

    fn row(artist: &str, title: &str, ms: Option<u64>) -> (String, String, Option<u64>) {
        (artist.to_string(), title.to_string(), ms)
    }

    #[test]
    fn web_rows_title_then_artist_with_durations() {
        let text = "\u{41C}\u{43E}\u{44F} \u{43F}\u{435}\u{441}\u{43D}\u{44F}\n\u{41C}\u{430}\u{43A}\u{441} \u{41A}\u{43E}\u{440}\u{436}\n3:45\nBangarang\nSkrillex, Sirah\n3:35\nNumb\nLinkin Park\n3:07\n";
        assert_eq!(
            rows(text),
            vec![
                row(
                    "\u{41C}\u{430}\u{43A}\u{441} \u{41A}\u{43E}\u{440}\u{436}",
                    "\u{41C}\u{43E}\u{44F} \u{43F}\u{435}\u{441}\u{43D}\u{44F}",
                    Some(225_000)
                ),
                row("Skrillex, Sirah", "Bangarang", Some(215_000)),
                row("Linkin Park", "Numb", Some(187_000)),
            ]
        );
        assert!(preview(text).vk);
        assert_eq!(preview(text).count, 3);
    }

    #[test]
    fn explicit_marker_and_feat_lines() {
        let text = "Lose Yourself\nE\nEminem\n5:26\nSicko Mode\nE\nTravis Scott\n5:12\nTitle\nfeat. Someone\nArtist\n2:58\n";
        assert_eq!(
            rows(text),
            vec![
                row("Eminem", "Lose Yourself", Some(326_000)),
                row("Travis Scott", "Sicko Mode", Some(312_000)),
                row("Artist", "Title feat. Someone", Some(178_000)),
            ]
        );
    }

    #[test]
    fn numbers_header_noise_and_hour_durations() {
        let text = "Playlist\nMy music\n1\nIntro\nBoris Brejcha\n1:02:03\n2\nGravity\nBoris Brejcha\n6:10\nShow more\n";
        assert_eq!(
            rows(text),
            vec![
                row("Boris Brejcha", "Intro", Some(3_723_000)),
                row("Boris Brejcha", "Gravity", Some(370_000)),
            ]
        );
    }

    #[test]
    fn mobile_artist_on_top_is_detected_by_repeats() {
        let text = "Boris Brejcha\nGravity\n6:10\nBoris Brejcha\nSpace Diver\n5:40\nBoris Brejcha\nNight Drive\n7:01\n";
        assert_eq!(
            rows(text),
            vec![
                row("Boris Brejcha", "Gravity", Some(370_000)),
                row("Boris Brejcha", "Space Diver", Some(340_000)),
                row("Boris Brejcha", "Night Drive", Some(421_000)),
            ]
        );
    }

    #[test]
    fn old_web_dash_on_its_own_line() {
        let text = "Moby\n\u{2013}\nPorcelain\n4:01\nDaft Punk\n\u{2014}\nOne More Time\n5:20\n";
        assert_eq!(
            rows(text),
            vec![
                row("Moby", "Porcelain", Some(241_000)),
                row("Daft Punk", "One More Time", Some(320_000)),
            ]
        );
    }

    #[test]
    fn one_line_rows_with_durations() {
        let text = "Moby - Porcelain\n4:01\nSkrillex \u{2014} Bangarang\n3:35\n";
        assert_eq!(
            rows(text),
            vec![
                row("Moby", "Porcelain", Some(241_000)),
                row("Skrillex", "Bangarang", Some(215_000)),
            ]
        );
    }

    #[test]
    fn without_durations_numbered_rows() {
        let text = "1\nBangarang\nSkrillex\nE\n2\nNumb\nLinkin Park\n3\nPorcelain\nMoby\n";
        assert_eq!(
            rows(text),
            vec![
                row("Skrillex", "Bangarang", None),
                row("Linkin Park", "Numb", None),
                row("Moby", "Porcelain", None),
            ]
        );
    }

    #[test]
    fn without_durations_blank_separated_pairs() {
        let text = "Bangarang\nSkrillex\n\nNumb\nLinkin Park\n\n\u{41F}\u{43E}\u{43A}\u{430}\n\u{41A}\u{438}\u{43D}\u{43E}\n";
        let found = rows(text);
        assert_eq!(found.len(), 3);
        assert_eq!(found[0], row("Skrillex", "Bangarang", None));
        assert_eq!(
            found[2],
            row(
                "\u{41A}\u{438}\u{43D}\u{43E}",
                "\u{41F}\u{43E}\u{43A}\u{430}",
                None
            )
        );
    }

    #[test]
    fn plain_lists_are_untouched() {
        let text = "Boris Brejcha - Gravity\n1. Daft Punk \u{2013} One More Time\nOnly A Title\nMoby\tPorcelain\n";
        assert!(!preview(text).vk);
        assert_eq!(preview(text).count, 4);
        assert_eq!(rows("Moby - Porcelain\n\nSkrillex - Bangarang\n").len(), 2);
        assert!(!preview("A\nB\nC\n").vk);
    }
}

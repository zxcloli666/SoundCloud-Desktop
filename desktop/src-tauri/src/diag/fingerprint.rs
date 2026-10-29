use sha2::{Digest, Sha256};

use super::errors::ErrorInput;

const FRAMES: usize = 3;

pub fn of(input: &ErrorInput) -> String {
    let context = |key: &str| input.context.get(key).map_or("", String::as_str);
    let basis = match input.kind.as_str() {
        "request" => format!(
            "request|{}|{}|{}",
            context("service"),
            numbered(context("path")),
            context("class")
        ),
        "playback" => format!("playback|{}|{}", context("reason"), context("quality")),
        kind => format!(
            "{kind}|{}|{}",
            numbered(&input.message),
            top_frames(input.stack.as_deref().unwrap_or(""))
        ),
    };
    hex::encode(&Sha256::digest(basis.as_bytes())[..8])
}

fn numbered(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut in_digits = false;
    for ch in text.chars() {
        if ch.is_ascii_digit() {
            if !in_digits {
                out.push('#');
            }
            in_digits = true;
        } else {
            in_digits = false;
            out.push(ch);
        }
    }
    out
}

fn top_frames(stack: &str) -> String {
    stack
        .lines()
        .filter(|line| line.contains(".js") || line.trim_start().starts_with("at "))
        .take(FRAMES)
        .map(|line| unhashed(line.trim()))
        .collect::<Vec<_>>()
        .join("|")
}

fn unhashed(frame: &str) -> String {
    let mut out = String::with_capacity(frame.len());
    let mut rest = frame;
    while let Some(at) = rest.find(".js") {
        let before = &rest[..at];
        let name_start = before
            .rfind(|ch: char| ch == '/' || ch == '(' || ch == ' ' || ch == '@')
            .map_or(0, |index| index + 1);
        let name = &before[name_start..];
        let stem = name.rsplit_once('-').map_or(name, |(stem, _)| stem);
        out.push_str(&before[..name_start]);
        out.push_str(stem);
        out.push_str(".js");
        rest = &rest[at + 3..];
    }
    out.push_str(rest);
    out
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::*;

    fn input(kind: &str, message: &str, stack: &str) -> ErrorInput {
        ErrorInput {
            kind: kind.to_string(),
            message: message.to_string(),
            stack: Some(stack.to_string()),
            component_stack: None,
            trace: None,
            context: BTreeMap::new(),
        }
    }

    const STACK: &str = "Error: boom\n    at render (http://tauri.localhost/assets/index-AbC123xy.js:10:20)\n    at a (http://tauri.localhost/assets/vendor-Zz9.js:1:2)\n    at b (x.js:1:1)\n    at c (x.js:2:2)";

    #[test]
    fn digits_do_not_change_the_fingerprint() {
        let a = of(&input("render", "track 123 failed", STACK));
        let b = of(&input("render", "track 98765 failed", STACK));
        assert_eq!(a, b);
        assert_eq!(a.len(), 16);
        assert_ne!(a, of(&input("unhandled", "track 123 failed", STACK)));
    }

    #[test]
    fn asset_hashes_and_deep_frames_are_ignored() {
        let rebuilt = STACK
            .replace("AbC123xy", "QqQ999zz")
            .replace("x.js:2:2", "y.js:9:9");
        assert_eq!(
            of(&input("render", "m", STACK)),
            of(&input("render", "m", &rebuilt))
        );
        assert_eq!(
            unhashed("at f (/assets/index-AbC123xy.js:1:2)"),
            "at f (/assets/index.js:1:2)"
        );
    }

    #[test]
    fn request_and_playback_use_their_own_basis() {
        let mut request = input("request", "different text", "");
        request.context.insert("service".into(), "api".into());
        request.context.insert("path".into(), "/tracks/123".into());
        request
            .context
            .insert("class".into(), "EdgeUnreachableError".into());
        let mut again = request.clone();
        again.message = "other text".into();
        again.context.insert("path".into(), "/tracks/456".into());
        assert_eq!(of(&request), of(&again));
        let mut playback = input("playback", "a", "");
        playback.context.insert("reason".into(), "no_stream".into());
        playback.context.insert("quality".into(), "hq".into());
        let mut other = playback.clone();
        other.message = "b".into();
        assert_eq!(of(&playback), of(&other));
        other.context.insert("quality".into(), "sq".into());
        assert_ne!(of(&playback), of(&other));
    }
}

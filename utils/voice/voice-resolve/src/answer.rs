use crate::entity::Scored;
use voice_nlu::{fold, normalize, similarity, Kind};

const FIRST: &[&str] = &["первый", "первое", "первая", "первую", "первого", "1", "верхний", "first", "левый"];
const SECOND: &[&str] = &["второй", "второе", "вторая", "вторую", "второго", "2", "нижний", "second", "правый"];
const LAST: &[&str] = &["последний", "последнее", "последняя", "последнюю", "last", "latter"];

fn kind_word(w: &str) -> Option<Kind> {
    match w {
        "артист" | "артиста" | "исполнитель" | "исполнителя" | "группа" | "группу" | "певец" | "artist" | "band" => Some(Kind::Artist),
        "песня" | "песню" | "трек" | "track" | "song" => Some(Kind::Track),
        "альбом" | "album" => Some(Kind::Album),
        "плейлист" | "playlist" => Some(Kind::Playlist),
        _ => None,
    }
}

pub fn answer_ask(text: &str, first: &Scored, second: &Scored) -> Option<usize> {
    let n = normalize(text);
    let words: Vec<&str> = n.toks.iter().map(|t| t.w.as_str()).collect();
    if words.iter().any(|w| FIRST.contains(w)) {
        return Some(0);
    }
    if words.iter().any(|w| SECOND.contains(w) || LAST.contains(w)) {
        return Some(1);
    }
    if let Some(kind) = words.iter().find_map(|w| kind_word(w)) {
        let a = first.entity.kind == kind;
        let b = second.entity.kind == kind;
        if a != b {
            return Some(if a { 0 } else { 1 });
        }
    }
    let heard = fold(&n.text);
    if heard.is_empty() {
        return None;
    }
    let rate = |s: &Scored| -> f32 {
        let name = similarity(&heard, &fold(&s.entity.name));
        let label = similarity(&heard, &fold(&s.entity.label()));
        name.max(label)
    };
    let (a, b) = (rate(first), rate(second));
    if a.max(b) >= 0.6 && (a - b).abs() >= 0.1 {
        return Some(if a > b { 0 } else { 1 });
    }
    None
}

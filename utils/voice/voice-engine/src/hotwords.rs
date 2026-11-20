const MAX: usize = 200;

pub const RUSSIAN_SCORE: f32 = 1.5;
pub const ENGLISH_SCORE: f32 = 2.0;

const COMMANDS: [&str; 24] = [
    "PLAY", "PAUSE", "STOP", "RESUME", "CONTINUE", "NEXT", "PREVIOUS", "SKIP", "TRACK", "SONG",
    "VOLUME", "LOUDER", "QUIETER", "MUTE", "UNMUTE", "SHUFFLE", "REPEAT", "LIKE", "LIKES",
    "UNLIKE", "QUEUE", "ADD", "REMOVE", "PLAYLIST",
];

const BETWEEN_WORDS: [char; 5] = ['-', '/', ',', '.', ':'];

pub fn russian(names: &[String]) -> Vec<String> {
    let cased = |name: &str| name.to_lowercase().replace('ё', "е");
    named(names, Vec::new(), cased, |c| ('а'..='я').contains(&c))
}

pub fn english(names: &[String]) -> Vec<String> {
    let commands = COMMANDS.iter().map(|word| word.to_string()).collect();
    let cased = |name: &str| name.to_uppercase().replace('&', " AND ");
    named(names, commands, cased, |c| {
        c == '\'' || c.is_ascii_uppercase()
    })
}

fn named(
    names: &[String],
    mut out: Vec<String>,
    cased: fn(&str) -> String,
    spelled: fn(char) -> bool,
) -> Vec<String> {
    let limit = out.len() + MAX;
    for name in names {
        let text = cased(name).replace(BETWEEN_WORDS, " ");
        let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
        let known = text.chars().all(|c| c == ' ' || spelled(c));
        let length = text.chars().count();
        if known && (2..=40).contains(&length) && !out.contains(&text) {
            out.push(text);
        }
        if out.len() == limit {
            break;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(list: &[&str]) -> Vec<String> {
        list.iter().map(|name| name.to_string()).collect()
    }

    #[test]
    fn russian_takes_cyrillic_names_only() {
        let got = russian(&names(&[
            "Кино",
            "Queen",
            "Король и Шут",
            "Ёлка",
            "Мот-Мот",
            "Кино",
        ]));
        assert_eq!(got, ["кино", "король и шут", "елка", "мот мот"]);
    }

    #[test]
    fn english_takes_latin_names_after_the_command_words() {
        let got = english(&names(&[
            "Dua Lipa",
            "Кино",
            "Blink-182",
            "Guns N' Roses",
            "AC/DC",
        ]));
        assert_eq!(got[..COMMANDS.len()], COMMANDS);
        assert_eq!(
            got[COMMANDS.len()..],
            ["DUA LIPA", "GUNS N' ROSES", "AC DC"]
        );
    }

    #[test]
    fn english_spells_a_name_the_way_it_is_said() {
        let got = english(&names(&[
            "Tyler, The Creator",
            "Florence & The Machine",
            "P!nk",
        ]));
        assert_eq!(
            got[COMMANDS.len()..],
            ["TYLER THE CREATOR", "FLORENCE AND THE MACHINE"]
        );
    }

    #[test]
    fn names_stop_at_the_limit() {
        let many: Vec<String> = (0..300)
            .map(|at| {
                let letters: String = at
                    .to_string()
                    .chars()
                    .map(|digit| (b'a' + digit as u8 - b'0') as char)
                    .collect();
                format!("band {letters}")
            })
            .collect();
        assert_eq!(english(&many).len(), COMMANDS.len() + MAX);
    }
}

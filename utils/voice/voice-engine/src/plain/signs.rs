use voice_g2p::figures::Tongue;

pub fn named(text: &str) -> String {
    text.replace('№', " номер ")
}

pub fn in_words(text: &str, usual: Tongue) -> String {
    let chars: Vec<char> = text.chars().collect();
    let whole = tongue(chars.iter(), usual);
    let mut out = String::with_capacity(text.len());
    for (at, c) in chars.iter().enumerate() {
        match c {
            '+' => out.push_str(match whole {
                Tongue::Ru => " плюс ",
                Tongue::En => " plus ",
            }),
            '&' => out.push_str(match tongue(around(&chars, at), whole) {
                Tongue::Ru => " и ",
                Tongue::En => " and ",
            }),
            '/' if !inside_latin(&chars, at) => out.push(' '),
            _ => out.push(*c),
        }
    }
    out
}

fn tongue<'a>(letters: impl Iterator<Item = &'a char>, usual: Tongue) -> Tongue {
    let mut latin = false;
    for c in letters {
        if c.is_ascii_alphabetic() {
            latin = true;
        } else if c.is_alphabetic() {
            return Tongue::Ru;
        }
    }
    if latin { Tongue::En } else { usual }
}

fn around(chars: &[char], at: usize) -> impl Iterator<Item = &char> {
    let before = chars[..at].iter().rev().find(|c| c.is_alphabetic());
    let after = chars[at + 1..].iter().find(|c| c.is_alphabetic());
    before.into_iter().chain(after)
}

fn inside_latin(chars: &[char], at: usize) -> bool {
    let latin = |c: Option<&char>| c.is_some_and(char::is_ascii_alphabetic);
    at > 0 && latin(chars.get(at - 1)) && latin(chars.get(at + 1))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_plus_is_said_in_the_language_of_the_text() {
        assert_eq!(in_words("Это C++", Tongue::En), "Это C плюс  плюс ");
        assert_eq!(
            in_words("C++ and Google+", Tongue::Ru),
            "C plus  plus  and Google plus "
        );
        assert_eq!(in_words("2 + 2", Tongue::Ru), "2  плюс  2");
        assert_eq!(in_words("2 + 2", Tongue::En), "2  plus  2");
    }

    #[test]
    fn an_ampersand_is_said_in_the_language_of_the_names_it_joins() {
        assert_eq!(in_words("Тимати & Джиган", Tongue::En), "Тимати  и  Джиган");
        assert_eq!(
            in_words("Включаю Simon & Garfunkel", Tongue::Ru),
            "Включаю Simon  and  Garfunkel"
        );
        assert_eq!(in_words("Иванушки & Co", Tongue::Ru), "Иванушки  и  Co");
    }

    #[test]
    fn a_slash_stays_only_inside_a_latin_name() {
        assert_eq!(in_words("AC/DC", Tongue::Ru), "AC/DC");
        assert_eq!(in_words("рок/поп", Tongue::Ru), "рок поп");
        assert_eq!(
            in_words("двадцать четыре/семь", Tongue::Ru),
            "двадцать четыре семь"
        );
        assert_eq!(in_words("Miyagi/Эндшпиль", Tongue::Ru), "Miyagi Эндшпиль");
    }

    #[test]
    fn the_number_sign_is_a_word() {
        assert_eq!(named("трек №5"), "трек  номер 5");
    }
}

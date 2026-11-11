use crate::sentences::spaced;

const HYPHENS: [char; 3] = ['-', '\u{2010}', '\u{2011}'];
const DASHES: [char; 3] = ['—', '–', '\u{2212}'];
const DOTS: [char; 2] = ['.', '…'];
const LOUD: [char; 2] = ['?', '!'];
const CLOSERS: [char; 2] = ['»', '"'];
const OPENERS: [char; 2] = ['«', '"'];
const ASIDES: [char; 4] = ['(', ')', '[', ']'];
const LOOSE: [char; 3] = [' ', ',', ';'];

pub fn smooth(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out = Vec::with_capacity(chars.len());
    let mut at = 0;
    while at < chars.len() {
        let c = chars[at];
        let dots = trailing_off(&chars, at);
        if dots > 0 {
            out.extend(pause(&chars, at, at + dots));
            at += dots;
            continue;
        }
        if HYPHENS.contains(&c) && inside_word(&chars, at) {
            out.push(' ');
        } else if HYPHENS.contains(&c) || DASHES.contains(&c) || ASIDES.contains(&c) {
            out.extend(part(&out).filter(|_| goes_on(&chars[at + 1..])));
            out.push(' ');
        } else {
            out.push(c);
        }
        at += 1;
    }
    let text = spaced(&out);
    ended(text.trim_start_matches(LOOSE).trim_end())
}

fn ended(text: &str) -> String {
    let last = text.chars().last();
    let open = last.is_some_and(|c| c.is_alphanumeric() || CLOSERS.contains(&c));
    format!("{text}{}", if open { "." } else { "" })
}

fn inside_word(chars: &[char], at: usize) -> bool {
    let joined = |c: Option<&char>| c.is_some_and(|c| c.is_alphanumeric());
    at > 0 && joined(chars.get(at - 1)) && joined(chars.get(at + 1))
}

fn part(said: &[char]) -> Option<char> {
    let last = said.iter().rev().find(|c| !c.is_whitespace())?;
    (last.is_alphanumeric() || CLOSERS.contains(last)).then_some(',')
}

fn goes_on(rest: &[char]) -> bool {
    let next = rest.iter().find(|c| !c.is_whitespace());
    next.is_some_and(|c| c.is_alphanumeric() || OPENERS.contains(c))
}

fn trailing_off(chars: &[char], at: usize) -> usize {
    let run = chars[at..].iter().take_while(|c| DOTS.contains(c)).count();
    match chars[at] {
        '…' => run,
        '.' if run > 1 => run,
        _ => 0,
    }
}

fn pause(chars: &[char], from: usize, to: usize) -> Option<char> {
    let said = chars[..from].iter().any(|c| c.is_alphanumeric());
    let loud = |c: Option<&char>| c.is_some_and(|c| LOUD.contains(c));
    if !said || loud(chars[..from].last()) || loud(chars.get(to)) {
        return None;
    }
    match chars[to..].iter().find(|c| c.is_alphanumeric()) {
        Some(next) if next.is_lowercase() => Some(','),
        _ => Some('.'),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_hyphen_inside_a_word_is_a_space() {
        assert_eq!(smooth("Включу что-нибудь?"), "Включу что нибудь?");
        assert_eq!(smooth("Из-за рок-н-ролла!"), "Из за рок н ролла!");
        assert_eq!(
            smooth("Lo-Fi и Jay-Z, twenty-one."),
            "Lo Fi и Jay Z, twenty one."
        );
        assert_eq!(smooth("кое\u{2011}что?"), "кое что?");
    }

    #[test]
    fn a_dash_between_parts_is_a_comma() {
        assert_eq!(smooth("Скриптонит — Цепи!"), "Скриптонит, Цепи!");
        assert_eq!(smooth("Скриптонит - Цепи!"), "Скриптонит, Цепи!");
        assert_eq!(smooth("Скриптонит – Цепи!"), "Скриптонит, Цепи!");
        assert_eq!(smooth("Скриптонит—Цепи!"), "Скриптонит, Цепи!");
        assert_eq!(smooth("Скриптонит -Цепи!"), "Скриптонит, Цепи!");
        assert_eq!(
            smooth("«Кино» — «Группа крови»!"),
            "«Кино», «Группа крови»!"
        );
    }

    #[test]
    fn a_dash_next_to_another_mark_or_to_nothing_is_dropped() {
        assert_eq!(smooth("Да, — сказал он. — Нет!"), "Да, сказал он. Нет!");
        assert_eq!(smooth("— Привет!"), "Привет!");
        assert_eq!(smooth("Привет! —"), "Привет!");
        assert_eq!(smooth("- Привет, -"), "Привет,");
    }

    #[test]
    fn brackets_around_an_aside_are_commas() {
        assert_eq!(
            smooth("Скриптонит (feat. Баста)!"),
            "Скриптонит, feat. Баста!"
        );
        assert_eq!(
            smooth("Это (кстати) «хороший» трек!"),
            "Это, кстати, «хороший» трек!"
        );
        assert_eq!(smooth("Track 01 [Remix] (Live)."), "Track 01, Remix, Live.");
        assert_eq!(smooth("(Интро) Начало?"), "Интро, Начало?");
    }

    #[test]
    fn trailing_off_is_a_comma_inside_a_sentence_and_a_full_stop_at_its_end() {
        assert_eq!(
            smooth("Ну... не знаю… может быть."),
            "Ну, не знаю, может быть."
        );
        assert_eq!(smooth("Даже не знаю..."), "Даже не знаю.");
        assert_eq!(smooth("Хм… Ладно."), "Хм. Ладно.");
        assert_eq!(smooth("Что?.. Не может быть!.."), "Что? Не может быть!");
        assert_eq!(smooth("…и тут!"), "и тут!");
    }

    #[test]
    fn a_text_left_open_ends_with_a_full_stop() {
        assert_eq!(smooth("Пауза"), "Пауза.");
        assert_eq!(
            smooth("Включаю Скриптонит — Цепи"),
            "Включаю Скриптонит, Цепи."
        );
        assert_eq!(smooth("Не нашлось «Кино»"), "Не нашлось «Кино».");
        assert_eq!(smooth("Привет —"), "Привет.");
        assert_eq!(smooth("Громкость 50"), "Громкость 50.");
    }

    #[test]
    fn a_text_that_ends_with_a_mark_keeps_it() {
        assert_eq!(smooth("Включить Кино?"), "Включить Кино?");
        assert_eq!(
            smooth("Сейчас включу что-нибудь,"),
            "Сейчас включу что нибудь,"
        );
        assert_eq!(smooth("Вот что нашлось:"), "Вот что нашлось:");
        assert_eq!(smooth(""), "");
        assert_eq!(smooth(" — "), "");
    }

    #[test]
    fn spaces_are_single_and_never_before_a_mark() {
        assert_eq!(smooth("Готово   включаю !"), "Готово включаю!");
        assert_eq!(smooth("  , Смотри  там , да."), "Смотри там, да.");
    }

    #[test]
    fn a_full_stop_and_a_fraction_stay() {
        assert_eq!(smooth("Пауза. Дальше."), "Пауза. Дальше.");
        assert_eq!(smooth("feat. Баста, iOS 17.4!"), "feat. Баста, iOS 17.4!");
    }
}

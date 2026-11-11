const LONGEST: usize = 240;
const CLAUSE_LEAST: usize = 40;
const OPENING_READY: usize = 48;
const OPENING_LEAST: usize = 16;

const ENDS: [char; 4] = ['.', '!', '?', '…'];
const CLOSERS: [char; 11] = ['"', '\'', '»', '”', '’', ')', ']', '*', '_', '`', '~'];
const CLAUSE_MARKS: [char; 5] = [',', ';', ':', '—', '–'];
const DASHES: [char; 3] = ['—', '–', '-'];
const BULLETS: [char; 6] = ['-', '—', '–', '•', '+', '>'];
const TIGHT: [char; 10] = [',', '.', '!', '?', ';', ':', '…', '»', ')', ']'];
const MARKUP: [char; 4] = ['*', '`', '~', '#'];
const VOWELS: &str = "aeiouyаеёиоуыэюя";

const TITLES: [&str; 18] = [
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "feat", "ft", "ул", "им", "проф",
    "акад", "доц", "напр", "св",
];
const SHORTENED: [&str; 12] = [
    "etc", "inc", "ltd", "co", "min", "sec", "approx", "vol", "мин", "сек", "руб", "коп",
];

pub struct Splitter {
    pending: Vec<char>,
    opening: bool,
    least: usize,
    held: String,
}

enum Dot {
    Ends,
    Inside,
    EndsBeforeCapital,
}

impl Splitter {
    pub fn new(least: usize) -> Splitter {
        Splitter {
            pending: Vec::new(),
            opening: true,
            least,
            held: String::new(),
        }
    }

    pub fn push(&mut self, text: &str) -> Vec<String> {
        let spoken = text.chars().map(|c| if pictured(c) { ' ' } else { c });
        self.pending.extend(spoken);
        self.cut(false)
    }

    pub fn finish(&mut self) -> Vec<String> {
        self.cut(true)
    }

    fn cut(&mut self, last: bool) -> Vec<String> {
        let mut sentences = Vec::new();
        while let Some(end) = self.end(last) {
            let piece: Vec<char> = self.pending.drain(..end).collect();
            let sentence = clean(&piece).and_then(|sentence| self.grown(sentence));
            sentences.extend(sentence);
        }
        if last || self.waited() {
            sentences.extend(self.release());
        }
        sentences
    }

    fn grown(&mut self, sentence: String) -> Option<String> {
        if !self.opening {
            return Some(sentence);
        }
        if self.held.ends_with(char::is_alphanumeric) {
            self.held.push('.');
        }
        if !self.held.is_empty() {
            self.held.push(' ');
        }
        self.held.push_str(&sentence);
        let enough = self.held.chars().count() >= self.least;
        enough.then(|| self.release()).flatten()
    }

    fn waited(&self) -> bool {
        self.pending.len() >= OPENING_READY && !unsettled(&self.pending)
    }

    fn release(&mut self) -> Option<String> {
        if self.held.is_empty() {
            return None;
        }
        self.opening = false;
        Some(std::mem::take(&mut self.held))
    }

    fn end(&self, last: bool) -> Option<usize> {
        let text = &self.pending;
        let rest = (last && !text.is_empty()).then_some(text.len());
        let early = || {
            (self.opening && !last)
                .then(|| opening_clause(text))
                .flatten()
        };
        let end = sentence_end(text).or_else(early).or(rest);
        match end {
            Some(end) if end > LONGEST => Some(capped(&text[..end])),
            None if text.len() > LONGEST => Some(capped(text)),
            end => end,
        }
    }
}

fn sentence_end(text: &[char]) -> Option<usize> {
    let mut at = 0;
    while at < text.len() {
        if text[at] == '\n' {
            if speakable(&text[..at]) {
                return Some(at + 1);
            }
            at += 1;
            continue;
        }
        if !ENDS.contains(&text[at]) {
            at += 1;
            continue;
        }
        let run = at + count(&text[at..], |c| ENDS.contains(&c));
        let closed = run + count(&text[run..], |c| CLOSERS.contains(&c));
        let space = closed + count(&text[closed..], char::is_whitespace);
        if closed == text.len() {
            return None;
        }
        if space == closed {
            at = closed;
            continue;
        }
        if text[closed..space].contains(&'\n') {
            return Some(closed);
        }
        let mark = &text[at..run];
        let loud = mark.iter().any(|c| matches!(c, '!' | '?'));
        if loud && closed == run {
            return Some(closed);
        }
        let Some(next) = text.get(space).copied() else {
            return None;
        };
        let continues = next.is_lowercase() || DASHES.contains(&next);
        let ends = match (loud, mark.len() == 1 && mark[0] == '.') {
            (true, _) => !continues,
            (false, false) => !next.is_lowercase(),
            (false, true) => match dot(text, at) {
                Dot::Inside => false,
                Dot::EndsBeforeCapital => next.is_uppercase(),
                Dot::Ends => closed == run || !continues,
            },
        };
        if ends {
            return Some(closed);
        }
        at = space;
    }
    None
}

fn dot(text: &[char], at: usize) -> Dot {
    let start = at - count_back(&text[..at], char::is_alphanumeric);
    let word: String = text[start..at]
        .iter()
        .flat_map(|c| c.to_lowercase())
        .collect();
    let letters = text[start..at].iter().all(|c| c.is_alphabetic());
    let size = at - start;
    if size == 0 {
        return Dot::Ends;
    }
    if text[start..at].iter().all(char::is_ascii_digit) {
        return if speakable(&text[..start]) {
            Dot::Ends
        } else {
            Dot::Inside
        };
    }
    if size == 1 && text[start].is_uppercase() {
        return Dot::Inside;
    }
    if TITLES.contains(&word.as_str()) {
        return Dot::Inside;
    }
    let initial = size == 1 && letters && word != "я";
    let clipped = size <= 4 && letters && !word.chars().any(|c| VOWELS.contains(c));
    if initial || clipped || SHORTENED.contains(&word.as_str()) {
        return Dot::EndsBeforeCapital;
    }
    Dot::Ends
}

fn opening_clause(text: &[char]) -> Option<usize> {
    if text.len() < OPENING_READY || unsettled(text) {
        return None;
    }
    clause(text, text.len(), OPENING_LEAST)
}

fn unsettled(text: &[char]) -> bool {
    let said = text.len() - count_back(text, char::is_whitespace);
    let closed = said - count_back(&text[..said], |c| CLOSERS.contains(&c));
    closed > 0 && ENDS.contains(&text[closed - 1])
}

fn capped(text: &[char]) -> usize {
    let limit = text.len().min(LONGEST);
    let word = || {
        let back = count_back(&text[..limit], |c| !c.is_whitespace());
        Some(limit - back).filter(|at| *at > 0)
    };
    clause(text, limit, CLAUSE_LEAST)
        .or_else(word)
        .unwrap_or(limit)
}

fn clause(text: &[char], limit: usize, least: usize) -> Option<usize> {
    (least..limit.min(text.len().saturating_sub(1)))
        .rev()
        .find(|at| CLAUSE_MARKS.contains(&text[*at]) && text[at + 1].is_whitespace())
        .map(|at| at + 1)
}

fn clean(piece: &[char]) -> Option<String> {
    let plain: String = unlinked(piece)
        .into_iter()
        .filter(|c| !MARKUP.contains(c))
        .map(|c| if c == '_' { ' ' } else { c })
        .collect();
    let item: Vec<char> = unlisted(&plain).chars().collect();
    let text = spaced(&balanced(&item));
    let text = text.trim_end_matches(DASHES).trim();
    text.chars()
        .any(char::is_alphanumeric)
        .then(|| text.to_string())
}

fn unlinked(piece: &[char]) -> Vec<char> {
    let mut out = Vec::with_capacity(piece.len());
    let mut at = 0;
    while at < piece.len() {
        let rest = &piece[at..];
        if starts_with(rest, "http://") || starts_with(rest, "https://") {
            at += count(rest, |c| !c.is_whitespace() && c != ')');
            continue;
        }
        if rest[0] == '['
            && let Some((label, size)) = link(rest)
        {
            out.extend_from_slice(label);
            at += size;
            continue;
        }
        out.push(rest[0]);
        at += 1;
    }
    out
}

fn link(text: &[char]) -> Option<(&[char], usize)> {
    let label = text.iter().position(|c| *c == ']')?;
    if text.get(label + 1) != Some(&'(') {
        return None;
    }
    let target = text[label..].iter().position(|c| *c == ')')?;
    Some((&text[1..label], label + target + 1))
}

fn balanced(text: &[char]) -> Vec<char> {
    let mut open = Vec::new();
    let mut lone = vec![false; text.len()];
    for (at, c) in text.iter().enumerate() {
        match c {
            '(' => open.push(at),
            ')' if open.pop().is_none() => lone[at] = true,
            _ => {}
        }
    }
    for at in open {
        lone[at] = true;
    }
    text.iter()
        .zip(lone)
        .filter(|(_, lone)| !lone)
        .map(|(c, _)| *c)
        .collect()
}

fn spaced(text: &[char]) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text {
        if c.is_whitespace() {
            if !out.is_empty() && !out.ends_with(' ') {
                out.push(' ');
            }
            continue;
        }
        if TIGHT.contains(c) && out.ends_with(' ') {
            out.pop();
        }
        out.push(*c);
    }
    out
}

fn unlisted(text: &str) -> &str {
    let mut text = text.trim();
    loop {
        let bullet = text
            .strip_prefix(BULLETS)
            .filter(|rest| rest.starts_with(' ') || rest.is_empty());
        let digits = text.trim_start_matches(|c: char| c.is_ascii_digit());
        let numbered = digits
            .strip_prefix(['.', ')'])
            .filter(|rest| digits.len() < text.len() && rest.starts_with(' '));
        match bullet.or(numbered) {
            Some(rest) => text = rest.trim_start(),
            None => return text,
        }
    }
}

fn pictured(c: char) -> bool {
    matches!(
        c as u32,
        0x200D
            | 0x20E3
            | 0x2190..=0x21FF
            | 0x2300..=0x23FF
            | 0x25A0..=0x27BF
            | 0x2B00..=0x2BFF
            | 0x3030
            | 0x303D
            | 0x3297
            | 0x3299
            | 0xFE00..=0xFE0F
            | 0x1F000..=0x1FAFF
            | 0xE0000..=0xE007F
    )
}

fn speakable(text: &[char]) -> bool {
    text.iter().any(|c| c.is_alphanumeric())
}

fn starts_with(text: &[char], prefix: &str) -> bool {
    text.len() >= prefix.len() && text.iter().zip(prefix.chars()).all(|(a, b)| *a == b)
}

fn count(text: &[char], matches: impl Fn(char) -> bool) -> usize {
    text.iter().take_while(|c| matches(**c)).count()
}

fn count_back(text: &[char], matches: impl Fn(char) -> bool) -> usize {
    text.iter().rev().take_while(|c| matches(**c)).count()
}

#[cfg(test)]
mod tests {
    use super::*;

    const STREAMED: usize = 20;

    fn whole(text: &str) -> Vec<String> {
        let mut splitter = Splitter::new(0);
        let mut out = splitter.push(text);
        out.extend(splitter.finish());
        out
    }

    fn streamed(text: &str, size: usize) -> Vec<String> {
        let chars: Vec<char> = text.chars().collect();
        let mut splitter = Splitter::new(0);
        let mut out = Vec::new();
        for piece in chars.chunks(size) {
            out.extend(splitter.push(&piece.iter().collect::<String>()));
        }
        out.extend(splitter.finish());
        out
    }

    #[test]
    fn sentences_come_out_one_by_one() {
        assert_eq!(
            whole("Привет! Как дела? Сейчас включу музыку. Готово"),
            ["Привет!", "Как дела?", "Сейчас включу музыку.", "Готово"]
        );
        assert_eq!(
            whole("Sure thing. Playing it now! Anything else?"),
            ["Sure thing.", "Playing it now!", "Anything else?"]
        );
    }

    #[test]
    fn a_sentence_waits_for_what_follows_the_dot() {
        let mut splitter = Splitter::new(0);
        assert!(splitter.push("Громкость 3").is_empty());
        assert!(splitter.push(".").is_empty());
        assert!(splitter.push("5 из десяти. ").is_empty());
        assert_eq!(splitter.push("Д"), ["Громкость 3.5 из десяти."]);
        assert_eq!(splitter.finish(), ["Д"]);
    }

    #[test]
    fn a_loud_mark_does_not_wait() {
        let mut splitter = Splitter::new(0);
        assert!(splitter.push("Конечно!").is_empty());
        assert_eq!(splitter.push(" "), ["Конечно!"]);
        assert!(splitter.push("Что?!").is_empty());
        assert_eq!(splitter.push(" Нет"), ["Что?!"]);
    }

    #[test]
    fn numbers_versions_and_names_with_dots_stay_whole() {
        assert_eq!(
            whole("Версия 2.0.1 вышла 12.05.2024 на soundcloud.com. Обновись."),
            [
                "Версия 2.0.1 вышла 12.05.2024 на soundcloud.com.",
                "Обновись."
            ]
        );
        assert_eq!(
            whole("It costs 3.5 dollars. Ok."),
            ["It costs 3.5 dollars.", "Ok."]
        );
    }

    #[test]
    fn initials_and_abbreviations_do_not_end_a_sentence() {
        assert_eq!(
            whole("Это написал А. С. Пушкин в 1830 г. в Болдино. Вот так."),
            ["Это написал А. С. Пушкин в 1830 г. в Болдино.", "Вот так."]
        );
        assert_eq!(
            whole("Рок, поп и т. д. и т. п. звучат тут. Dr. Dre feat. Eminem vs. Mr. Nobody."),
            [
                "Рок, поп и т. д. и т. п. звучат тут.",
                "Dr. Dre feat. Eminem vs. Mr. Nobody."
            ]
        );
        assert_eq!(
            whole("Живёт на ул. Ленина, т.е. рядом. Осталось 5 мин. Потом выключу."),
            [
                "Живёт на ул. Ленина, т.е. рядом.",
                "Осталось 5 мин.",
                "Потом выключу."
            ]
        );
        assert_eq!(whole("Это я. Привет."), ["Это я.", "Привет."]);
    }

    #[test]
    fn lowercase_writing_still_splits() {
        assert_eq!(
            whole("привет. как дела. включаю"),
            ["привет.", "как дела.", "включаю"]
        );
    }

    #[test]
    fn an_ellipsis_ends_only_before_a_new_sentence() {
        assert_eq!(
            whole("Ну... не знаю… Может быть. Хм... Ладно."),
            ["Ну... не знаю…", "Может быть.", "Хм...", "Ладно."]
        );
    }

    #[test]
    fn quotes_close_with_their_sentence() {
        assert_eq!(
            whole("Он сказал: «Включай!» И я включила. \"Done.\" Next."),
            [
                "Он сказал: «Включай!»",
                "И я включила.",
                "\"Done.\"",
                "Next."
            ]
        );
        assert_eq!(
            whole("«Привет!» — сказал он. Она спросила «Зачем?» и ушла."),
            ["«Привет!» — сказал он.", "Она спросила «Зачем?» и ушла."]
        );
    }

    #[test]
    fn emoji_and_markdown_are_not_spoken() {
        assert_eq!(
            whole("**Привет!** 😊 Вот _твой_ трек 🎵🔥. Слушай `сейчас`👍🏽"),
            ["Привет!", "Вот твой трек.", "Слушай сейчас"]
        );
        assert_eq!(
            whole("Смотри [тут](https://example.com/a.b) или на https://example.com/x. Ок)))"),
            ["Смотри тут или на", "Ок"]
        );
        assert_eq!(whole("😊🔥"), Vec::<String>::new());
        assert_eq!(
            whole("Привет (как обычно) всем)"),
            ["Привет (как обычно) всем"]
        );
    }

    #[test]
    fn list_lines_are_sentences_without_their_markers() {
        assert_eq!(
            whole("# Вот список\n- первый трек\n- второй трек\n1. третий\n2) четвёртый\n\nВсё"),
            [
                "Вот список",
                "первый трек",
                "второй трек",
                "третий",
                "четвёртый",
                "Всё"
            ]
        );
    }

    #[test]
    fn a_short_opening_waits_for_the_next_sentence_when_the_voice_streams() {
        let mut splitter = Splitter::new(STREAMED);
        assert!(splitter.push("Привет! ").is_empty());
        assert!(splitter.push("Сейчас включу что-нибудь").is_empty());
        assert_eq!(
            splitter.push(" спокойное. Думаю"),
            ["Привет! Сейчас включу что-нибудь спокойное."]
        );
        assert_eq!(
            splitter.push(", понравится. Да! "),
            ["Думаю, понравится.", "Да!"]
        );

        let mut splitter = Splitter::new(STREAMED);
        assert_eq!(
            splitter.push("Да. Нет. Не знаю, честно говоря. Вот"),
            ["Да. Нет. Не знаю, честно говоря."]
        );
        assert_eq!(splitter.finish(), ["Вот"]);
    }

    #[test]
    fn a_short_opening_does_not_wait_longer_than_a_few_words() {
        let mut splitter = Splitter::new(STREAMED);
        assert!(
            splitter
                .push("Хорошо! Сейчас я подберу для тебя")
                .is_empty()
        );
        assert_eq!(
            splitter.push(" что-нибудь, что точно понравится"),
            ["Хорошо! Сейчас я подберу для тебя что-нибудь,"]
        );

        let mut splitter = Splitter::new(STREAMED);
        assert!(
            splitter
                .push("Хорошо! Сейчас я подберу для тебя")
                .is_empty()
        );
        assert_eq!(splitter.push(" что-нибудь совсем особенное"), ["Хорошо!"]);
        assert_eq!(
            splitter.push(" и приятное. Вот"),
            ["Сейчас я подберу для тебя что-нибудь совсем особенное и приятное."]
        );
    }

    #[test]
    fn a_short_reply_is_spoken_whole_when_it_ends() {
        let mut splitter = Splitter::new(STREAMED);
        assert!(splitter.push("Привет! Пока.").is_empty());
        assert_eq!(splitter.finish(), ["Привет! Пока."]);

        let mut splitter = Splitter::new(STREAMED);
        assert!(splitter.push("Ок").is_empty());
        assert_eq!(splitter.finish(), ["Ок"]);
        assert!(splitter.finish().is_empty());

        let mut splitter = Splitter::new(STREAMED);
        assert!(splitter.push("Вот список\n- раз\n").is_empty());
        assert_eq!(splitter.push("- два\nВсё"), ["Вот список. раз. два"]);
    }

    #[test]
    fn a_long_opening_sentence_starts_with_its_first_clause() {
        let mut splitter = Splitter::new(0);
        let early = splitter.push("Сейчас поищу что-нибудь подходящее под настроение, ");
        assert_eq!(
            early,
            ["Сейчас поищу что-нибудь подходящее под настроение,"]
        );
        assert!(splitter.push("подожди секунду, я быстро, ").is_empty());
        assert_eq!(
            splitter.push("честно. Вот"),
            ["подожди секунду, я быстро, честно."]
        );
    }

    #[test]
    fn a_short_or_finished_opening_is_not_cut_at_a_comma() {
        let mut splitter = Splitter::new(0);
        assert!(splitter.push("Конечно, сейчас включу, ").is_empty());
        assert!(splitter.push("погоди.").is_empty());
        let mut splitter = Splitter::new(0);
        let done = "Сейчас поищу что-нибудь подходящее, подожди секунду.";
        assert!(splitter.push(done).is_empty());
        assert_eq!(splitter.finish(), [done]);
    }

    #[test]
    fn an_endless_sentence_is_cut_at_a_clause_then_at_a_word() {
        let clause = "слово за словом идёт очень длинная фраза без конца, ";
        let cut = whole(&clause.repeat(8));
        assert!(cut.len() >= 2, "{cut:?}");
        assert!(cut.iter().all(|s| s.chars().count() <= LONGEST), "{cut:?}");
        assert!(
            cut[..cut.len() - 1].iter().all(|s| s.ends_with(',')),
            "{cut:?}"
        );

        let words = whole(&"слово ".repeat(100));
        assert!(words.len() >= 3, "{words:?}");
        assert!(words.iter().all(|s| s.chars().count() <= LONGEST));
        assert!(words.iter().all(|s| s.ends_with("слово")));
        assert_eq!(words.join(" "), "слово ".repeat(100).trim());
    }

    #[test]
    fn the_cut_does_not_depend_on_how_the_text_arrives() {
        let text = "Привет! Сегодня 3.5 градуса, т. е. холодно... Но музыка греет. \
                    Включаю «Кино»? Dr. Dre тоже есть. Готово";
        let expected = whole(text);
        assert_eq!(expected.len(), 6, "{expected:?}");
        for size in [1, 2, 3, 7, 15, 40] {
            assert_eq!(streamed(text, size), expected, "by {size}");
        }
    }
}

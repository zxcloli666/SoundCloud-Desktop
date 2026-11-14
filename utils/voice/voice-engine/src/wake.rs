use crate::config::Language;
use crate::voices;

const KEEN_FROM: f32 = 0.6;
const CALLS: [&str; 6] = ["эй", "окей", "ок", "hey", "okay", "ok"];
const GLUED: [&str; 14] = [
    "play", "pause", "stop", "next", "skip", "resume", "like", "shuffle", "repeat", "mute", "turn",
    "put", "add", "open",
];

struct Names {
    sure: &'static [&'static str],
    stems: &'static [&'static str],
    weak: &'static [&'static str],
    near: &'static [&'static str],
    hints: &'static [&'static str],
}

const NOBODY: Names = Names {
    sure: &[],
    stems: &[],
    weak: &[],
    near: &[],
    hints: &[],
};

#[derive(Debug, PartialEq)]
pub enum Call<'a> {
    Sure(&'a str),
    Weak(&'a str),
}

pub struct Ear {
    names: [&'static Names; 2],
    keen: bool,
}

fn assistant(language: Language) -> &'static Names {
    match language {
        Language::Ru => &Names {
            sure: &["саунд"],
            stems: &[],
            weak: &[],
            near: &[],
            hints: &["саунд"],
        },
        Language::En => &Names {
            sure: &["sound"],
            stems: &[],
            weak: &[],
            near: &[],
            hints: &["SOUND"],
        },
    }
}

fn character(language: Language, voice: &str) -> &'static Names {
    match (language, voice) {
        (Language::Ru, voices::DEFAULT) => &Names {
            sure: &["лоля", "клоля", "флоля"],
            stems: &[],
            weak: &[],
            near: &["оля", "толя", "леля", "лола"],
            hints: &["лоля"],
        },
        (Language::Ru, voices::MORIARTY) => &Names {
            sure: &["мори"],
            stems: &["мориар", "мариар"],
            weak: &["море"],
            near: &[],
            hints: &["мори", "мориарти"],
        },
        (Language::En, voices::DEFAULT) => &Names {
            sure: &["loli", "lolly", "lolli"],
            stems: &[],
            weak: &[],
            near: &["lola", "lowly"],
            hints: &["LOLLY"],
        },
        (Language::En, voices::MORIARTY) => &Names {
            sure: &["mori"],
            stems: &["moriart"],
            weak: &[],
            near: &[],
            hints: &["MORI", "MORIARTY"],
        },
        _ => &NOBODY,
    }
}

impl Ear {
    pub fn new(language: Language, voice: &str, sensitivity: f32) -> Ear {
        Ear {
            names: [assistant(language), character(language, voice)],
            keen: sensitivity >= KEEN_FROM,
        }
    }

    pub fn call<'a>(&self, text: &'a str) -> Option<Call<'a>> {
        self.heard(text, self.keen)
    }

    pub fn recall<'a>(&self, text: &'a str) -> Option<Call<'a>> {
        self.heard(text, true)
    }

    pub fn hints(&self) -> Vec<String> {
        let hints = self.names.iter().flat_map(|names| names.hints);
        hints.map(|hint| hint.to_string()).collect()
    }

    fn heard<'a>(&self, text: &'a str, keen: bool) -> Option<Call<'a>> {
        let text = text.trim_start();
        let (first, rest) = split(text);
        let text = if CALLS.contains(&spelled(first).as_str()) {
            rest
        } else {
            text
        };
        let (first, rest) = split(text);
        let word = spelled(first);
        let said = |names: &[&str]| names.contains(&word.as_str());
        let begun = |stems: &[&str]| stems.iter().any(|stem| word.starts_with(stem));
        if self
            .names
            .iter()
            .any(|names| said(names.sure) || begun(names.stems))
        {
            return Some(Call::Sure(rest));
        }
        if self.names.iter().any(|names| said(names.weak)) {
            return Some(Call::Weak(rest));
        }
        if keen && self.names.iter().any(|names| said(names.near)) {
            return (!rest.is_empty()).then_some(Call::Weak(rest));
        }
        self.glued(text, &word).map(Call::Sure)
    }

    fn glued<'a>(&self, text: &'a str, word: &str) -> Option<&'a str> {
        let run_in = |name: &&&str| {
            word.strip_prefix(**name)
                .is_some_and(|tail| GLUED.contains(&tail))
        };
        let name = self
            .names
            .iter()
            .flat_map(|names| names.sure)
            .find(run_in)?;
        text.get(name.len()..)
    }
}

fn split(text: &str) -> (&str, &str) {
    match text.split_once(char::is_whitespace) {
        Some((first, rest)) => (first, rest.trim_start()),
        None => (text, ""),
    }
}

fn spelled(word: &str) -> String {
    word.trim_matches(|c: char| !c.is_alphanumeric())
        .to_lowercase()
        .replace('ё', "е")
}

#[cfg(test)]
mod tests {
    use super::*;

    const USUAL: f32 = 0.5;
    const KEEN: f32 = 0.8;

    fn loli(language: Language, sensitivity: f32) -> Ear {
        Ear::new(language, voices::DEFAULT, sensitivity)
    }

    fn moriarty(language: Language, sensitivity: f32) -> Ear {
        Ear::new(language, voices::MORIARTY, sensitivity)
    }

    #[test]
    fn a_phrase_that_starts_with_the_name_gives_the_rest() {
        let ear = loli(Language::Ru, USUAL);
        assert_eq!(
            ear.call("лоля включи кино"),
            Some(Call::Sure("включи кино"))
        );
        assert_eq!(
            ear.call("Саунд, следующий трек"),
            Some(Call::Sure("следующий трек"))
        );
        assert_eq!(ear.call("лоля"), Some(Call::Sure("")));
        assert_eq!(ear.call("клоля"), Some(Call::Sure("")));
        let ear = loli(Language::En, USUAL);
        assert_eq!(ear.call("sound play queen"), Some(Call::Sure("play queen")));
        assert_eq!(ear.call("lolly next track"), Some(Call::Sure("next track")));
    }

    #[test]
    fn each_character_answers_to_its_own_name_and_to_the_assistant_name() {
        let ear = moriarty(Language::Ru, USUAL);
        assert_eq!(
            ear.call("мори включи кино"),
            Some(Call::Sure("включи кино"))
        );
        assert_eq!(
            ear.call("мариарде сделай погромче"),
            Some(Call::Sure("сделай погромче"))
        );
        assert_eq!(ear.call("мориарте"), Some(Call::Sure("")));
        assert_eq!(ear.call("морячок включи кино"), None);
        assert_eq!(ear.call("саунд пауза"), Some(Call::Sure("пауза")));
        assert_eq!(ear.call("лоля включи кино"), None);
        assert_eq!(loli(Language::Ru, USUAL).call("мори включи кино"), None);
        let other = Ear::new(Language::En, "af_heart", KEEN);
        assert_eq!(other.call("sound pause"), Some(Call::Sure("pause")));
        assert_eq!(other.call("lolly pause"), None);
    }

    #[test]
    fn a_call_word_before_the_name_is_skipped() {
        assert_eq!(
            loli(Language::Ru, USUAL).call("эй лоля включи кино"),
            Some(Call::Sure("включи кино"))
        );
        assert_eq!(
            loli(Language::En, USUAL).call("hey sound pause"),
            Some(Call::Sure("pause"))
        );
    }

    #[test]
    fn the_name_in_the_middle_or_inside_a_word_does_not_count() {
        let ear = loli(Language::Ru, KEEN);
        assert_eq!(ear.call("включи лоля кино"), None);
        assert_eq!(ear.call("саундтрек к фильму"), None);
        assert_eq!(ear.call("включи кино"), None);
        assert_eq!(loli(Language::En, KEEN).call("sounds good to me"), None);
    }

    #[test]
    fn a_name_run_into_the_command_word_still_counts() {
        let ear = loli(Language::En, USUAL);
        assert_eq!(ear.call("soundplay queen"), Some(Call::Sure("play queen")));
        assert_eq!(ear.call("lolliplay queen"), Some(Call::Sure("play queen")));
        assert_eq!(ear.call("soundtrack of the year"), None);
        assert_eq!(ear.call("soundcloud is great"), None);
    }

    #[test]
    fn a_name_of_the_other_language_does_not_count() {
        assert_eq!(loli(Language::Ru, KEEN).call("sound play queen"), None);
        assert_eq!(loli(Language::En, KEEN).call("саунд включи кино"), None);
    }

    #[test]
    fn a_word_that_only_sounds_like_the_name_is_a_weak_call() {
        let ear = moriarty(Language::Ru, USUAL);
        assert_eq!(
            ear.call("море включи кино"),
            Some(Call::Weak("включи кино"))
        );
        assert_eq!(ear.call("море"), Some(Call::Weak("")));
        assert_eq!(loli(Language::Ru, USUAL).call("оля включи кино"), None);
        let keen = loli(Language::Ru, KEEN);
        assert_eq!(
            keen.call("оля включи кино"),
            Some(Call::Weak("включи кино"))
        );
        assert_eq!(keen.call("оля"), None);
    }

    #[test]
    fn at_the_end_of_the_phrase_near_sounds_are_weak_calls_too() {
        let ear = loli(Language::Ru, USUAL);
        assert_eq!(
            ear.recall("толя поставь на паузу"),
            Some(Call::Weak("поставь на паузу"))
        );
        assert_eq!(
            ear.recall("лоля включи кино"),
            Some(Call::Sure("включи кино"))
        );
        assert_eq!(ear.recall("включи кино"), None);
    }

    #[test]
    fn the_recognizer_is_told_the_names_it_can_spell() {
        assert_eq!(loli(Language::Ru, USUAL).hints(), ["саунд", "лоля"]);
        assert_eq!(
            moriarty(Language::Ru, USUAL).hints(),
            ["саунд", "мори", "мориарти"]
        );
        assert_eq!(loli(Language::En, USUAL).hints(), ["SOUND", "LOLLY"]);
    }
}

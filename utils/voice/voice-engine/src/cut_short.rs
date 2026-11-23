const TAIL_LETTERS: usize = 4;

pub fn cut_short(exact: &str, streaming: &str) -> bool {
    let exact = words(exact);
    let streaming = words(streaming);
    if exact.is_empty() || streaming.len() <= exact.len() || streaming[..exact.len()] != exact[..] {
        return false;
    }
    let tail: usize = streaming[exact.len()..]
        .iter()
        .map(|word| word.chars().filter(|c| c.is_alphabetic()).count())
        .sum();
    tail >= TAIL_LETTERS
}

fn words(text: &str) -> Vec<String> {
    text.split_whitespace().map(str::to_lowercase).collect()
}

#[cfg(test)]
mod tests {
    use super::cut_short;

    #[test]
    fn an_exact_pass_that_kept_only_the_start_of_the_phrase_is_cut_short() {
        assert!(cut_short("включи", "включи психосисчил чайн"));
        assert!(cut_short("Включи", "включи психосис"));
    }

    #[test]
    fn a_full_or_different_exact_pass_or_a_stray_short_tail_is_kept() {
        assert!(!cut_short(
            "включи психосис гуд раша",
            "включи психосис гот раша"
        ));
        assert!(!cut_short("пауза", "пауза в"));
        assert!(!cut_short("трек включи", "проек включи"));
        assert!(!cut_short("лайк", "лайк"));
        assert!(!cut_short("", "включи психосис"));
    }
}

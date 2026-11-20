pub(crate) fn spelled(text: &str) -> String {
    replaced(text, 's')
}

pub(crate) fn spaced(text: &str) -> String {
    replaced(text, ' ')
}

pub(crate) fn has_spelled(text: &str) -> bool {
    text.contains('$') && spelled(text) != text
}

fn replaced(text: &str, with: char) -> String {
    if !text.contains('$') {
        return text.to_string();
    }
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len());
    let mut i = 0;
    while i < chars.len() {
        if chars[i] != '$' {
            out.push(chars[i]);
            i += 1;
            continue;
        }
        let end = chars[i..]
            .iter()
            .position(|&c| c != '$')
            .map_or(chars.len(), |n| i + n);
        let before = i > 0 && chars[i - 1].is_alphabetic();
        let after = chars.get(end).is_some_and(|c| c.is_alphabetic());
        let letter = if before || after { with } else { '$' };
        out.extend(std::iter::repeat_n(letter, end - i));
        i = end;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_dollar_touching_a_letter_reads_as_s() {
        assert_eq!(spelled("$uicideboy$"), "suicideboys");
        assert_eq!(spelled("Ke$ha"), "Kesha");
        assert_eq!(spelled("Joey Bada$$"), "Joey Badass");
        assert_eq!(spelled("A$AP Rocky"), "AsAP Rocky");
        assert_eq!(spelled("GAYAZOV$ BROTHER$"), "GAYAZOVs BROTHERs");
    }

    #[test]
    fn a_dollar_touching_only_digits_or_spaces_stays() {
        for text in ["100$", "$100", "$ UICIDEBOY $", "5 $", "$"] {
            assert_eq!(spelled(text), text);
            assert!(!has_spelled(text));
        }
    }

    #[test]
    fn the_old_reading_turns_the_spelled_dollars_into_spaces() {
        assert_eq!(spaced("$uicideboy$"), " uicideboy ");
        assert_eq!(spaced("Bada$$ 5$"), "Bada   5$");
        assert!(has_spelled("Ke$ha"));
    }
}

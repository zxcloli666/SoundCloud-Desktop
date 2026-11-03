const MAX: usize = 200;

pub fn russian(names: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for name in names {
        let lower = name.to_lowercase().replace('ё', "е").replace('-', " ");
        let words: Vec<&str> = lower.split_whitespace().collect();
        let text = words.join(" ");
        let cyrillic = text.chars().all(|c| c == ' ' || ('а'..='я').contains(&c));
        let length = text.chars().count();
        if cyrillic && (2..=40).contains(&length) && !out.contains(&text) {
            out.push(text);
        }
        if out.len() == MAX {
            break;
        }
    }
    out
}

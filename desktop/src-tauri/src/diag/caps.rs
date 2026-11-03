pub fn cut(text: &str, max: usize) -> String {
    text.chars().take(max).collect()
}

#[cfg(test)]
mod tests {
    use super::cut;

    #[test]
    fn text_is_cut_by_characters() {
        assert_eq!(cut("abcdef", 3), "abc");
        assert_eq!(cut("ab", 3), "ab");
        assert_eq!(cut("ыыыы", 2), "ыы");
    }
}

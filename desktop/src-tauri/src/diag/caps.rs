pub const KEY: usize = 64;
pub const MESSAGE: usize = 2000;
pub const STACK: usize = 8000;
pub const COMPONENT_STACK: usize = 4000;
pub const PATH: usize = 1000;
pub const ERROR: usize = 1000;
pub const LOG_LINE: usize = 500;
pub const NETCHECK: usize = 8192;
pub const CONTEXT_VALUE: usize = 300;

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

pub const SESSION_EXPIRED: &str = "session_expired";
pub const YM_TOKEN_INVALID: &str = "ym_token_invalid";
pub const YM_UNAVAILABLE: &str = "ym_unavailable";
pub const SEARCH_UNAVAILABLE: &str = "search_unavailable";
pub const SOURCE_UNAVAILABLE: &str = "source_unavailable";
pub const SOURCE_NOT_FOUND: &str = "source_not_found";
pub const SOURCE_UNPARSED: &str = "source_unparsed";
pub const SOURCE_EMPTY: &str = "source_empty";
pub const BAD_LINK: &str = "bad_link";

#[derive(Debug)]
pub struct Failure {
    pub code: &'static str,
    pub detail: String,
}

impl Failure {
    pub fn new(code: &'static str, detail: impl Into<String>) -> Self {
        Self {
            code,
            detail: detail.into(),
        }
    }

    pub fn unavailable(detail: impl ToString) -> Self {
        Self::new(SOURCE_UNAVAILABLE, detail.to_string())
    }
}

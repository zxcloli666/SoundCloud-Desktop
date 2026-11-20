use std::fmt;
use std::io::Read;

pub struct Response {
    pub start: u64,
    pub total: u64,
    pub body: Box<dyn Read + Send>,
}

#[derive(Debug)]
pub enum FetchError {
    Network(String),
    Status(u16),
}

impl FetchError {
    pub fn is_retryable(&self) -> bool {
        match self {
            FetchError::Network(_) => true,
            FetchError::Status(code) => *code == 429 || *code >= 500,
        }
    }
}

impl fmt::Display for FetchError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FetchError::Network(e) => write!(f, "{e}"),
            FetchError::Status(code) => write!(f, "http status {code}"),
        }
    }
}

pub trait Fetch: Send + Sync {
    fn get(&self, url: &str, offset: u64) -> Result<Response, FetchError>;
}

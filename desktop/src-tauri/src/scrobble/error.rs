#[derive(Debug)]
pub enum ApiError {
    Pending,
    Session,
    Retry(String),
    Rejected(String),
}

impl ApiError {
    pub fn from_status(status: u16, body: &str) -> Self {
        let detail = format!(
            "HTTP {status}: {}",
            body.chars().take(200).collect::<String>()
        );
        match status {
            401 | 403 => Self::Session,
            429 | 500..=599 => Self::Retry(detail),
            _ => Self::Rejected(detail),
        }
    }

    pub fn network(err: impl std::fmt::Display) -> Self {
        Self::Retry(err.to_string())
    }
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => f.write_str("waiting for confirmation"),
            Self::Session => f.write_str("session expired"),
            Self::Retry(detail) | Self::Rejected(detail) => f.write_str(detail),
        }
    }
}

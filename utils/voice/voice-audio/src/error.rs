use std::fmt;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ErrorCode {
    MicDenied,
    MicBusy,
    MicLost,
    Other,
}

impl ErrorCode {
    pub fn as_str(self) -> &'static str {
        match self {
            ErrorCode::MicDenied => "mic_denied",
            ErrorCode::MicBusy => "mic_busy",
            ErrorCode::MicLost => "mic_lost",
            ErrorCode::Other => "other",
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct CaptureError {
    pub code: ErrorCode,
    pub input: Option<String>,
    pub detail: String,
}

impl CaptureError {
    pub fn new(code: ErrorCode, detail: impl Into<String>) -> Self {
        Self {
            code,
            input: None,
            detail: detail.into(),
        }
    }

    pub fn for_input(mut self, input: &str) -> Self {
        self.input = Some(input.to_string());
        self
    }

    pub fn classify(text: &str) -> Self {
        let lower = text.to_lowercase();
        let denied = [
            "access is denied",
            "access denied",
            "0x80070005",
            "permission",
            "not authorized",
            "not authorised",
            "privacy",
            "e_accessdenied",
        ];
        let busy = [
            "busy",
            "in use",
            "exclusive",
            "0x8889000a",
            "0x88890004",
            "audclnt_e_device_in_use",
        ];
        let lost = [
            "no longer available",
            "not available",
            "disconnected",
            "no such device",
            "not found",
            "unplugged",
            "invalidated",
            "0x88890004",
            "0x80070490",
        ];
        let code = if denied.iter().any(|m| lower.contains(m)) {
            ErrorCode::MicDenied
        } else if busy.iter().any(|m| lower.contains(m)) {
            ErrorCode::MicBusy
        } else if lost.iter().any(|m| lower.contains(m)) {
            ErrorCode::MicLost
        } else {
            ErrorCode::Other
        };
        Self::new(code, text)
    }
}

impl From<cpal::BuildStreamError> for CaptureError {
    fn from(err: cpal::BuildStreamError) -> Self {
        match err {
            cpal::BuildStreamError::DeviceNotAvailable => {
                Self::new(ErrorCode::MicLost, err.to_string())
            }
            other => Self::classify(&other.to_string()),
        }
    }
}

impl From<cpal::StreamError> for CaptureError {
    fn from(err: cpal::StreamError) -> Self {
        match err {
            cpal::StreamError::DeviceNotAvailable | cpal::StreamError::StreamInvalidated => {
                Self::new(ErrorCode::MicLost, err.to_string())
            }
            other => Self::classify(&other.to_string()),
        }
    }
}

impl From<cpal::PlayStreamError> for CaptureError {
    fn from(err: cpal::PlayStreamError) -> Self {
        match err {
            cpal::PlayStreamError::DeviceNotAvailable => {
                Self::new(ErrorCode::MicLost, err.to_string())
            }
            other => Self::classify(&other.to_string()),
        }
    }
}

impl fmt::Display for CaptureError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.code.as_str(), self.detail)
    }
}

impl std::error::Error for CaptureError {}

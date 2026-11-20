use std::fmt;
use std::io;

#[derive(Debug)]
pub enum Error {
    UnknownModel(String),
    Busy(String),
    Cancelled,
    Io(io::Error),
    Network(String),
    Http(u16),
    Sha256Mismatch { file: String },
    Manifest(String),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::UnknownModel(id) => write!(f, "unknown model {id}"),
            Error::Busy(id) => write!(f, "model {id} is busy"),
            Error::Cancelled => write!(f, "cancelled"),
            Error::Io(e) => write!(f, "io: {e}"),
            Error::Network(e) => write!(f, "network: {e}"),
            Error::Http(code) => write!(f, "http status {code}"),
            Error::Sha256Mismatch { file } => write!(f, "sha256 mismatch for {file}"),
            Error::Manifest(e) => write!(f, "manifest: {e}"),
        }
    }
}

impl std::error::Error for Error {}

impl From<io::Error> for Error {
    fn from(e: io::Error) -> Self {
        Error::Io(e)
    }
}

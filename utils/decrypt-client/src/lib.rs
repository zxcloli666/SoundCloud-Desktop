#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("disabled")]
    Disabled,
    #[error("media: {0}")]
    Media(String),
}

impl Error {
    pub fn is_disabled(&self) -> bool {
        matches!(self, Error::Disabled)
    }
}

pub fn decrypt_segment(_seg: &[u8], _key: &[u8; 16]) -> Result<Vec<u8>, Error> {
    Err(Error::Disabled)
}

pub fn iter_boxes(_b: &[u8], _f: impl FnMut(&str, usize, usize)) {}

pub fn find_box(_b: &[u8], _path: &[&str]) -> Option<(usize, usize)> {
    None
}

pub fn sample_entry_hdr(_bx: &[u8]) -> usize {
    0
}


use std::sync::atomic::AtomicBool;

pub type OnRead<'a> = &'a (dyn Fn(usize, usize) + Send + Sync);

pub type Cancel = AtomicBool;

#[derive(Clone, Debug, PartialEq)]
pub struct ExtTrack {
    pub artist: String,
    pub title: String,
    pub duration_ms: Option<u64>,
}

impl ExtTrack {
    pub fn label(&self) -> String {
        match (self.artist.is_empty(), self.title.is_empty()) {
            (false, false) => format!("{} - {}", self.artist, self.title),
            (true, _) => self.title.clone(),
            (_, true) => self.artist.clone(),
        }
    }
}

#[derive(Debug)]
pub struct ExtList {
    pub title: String,
    pub tracks: Vec<ExtTrack>,
    pub partial: bool,
}

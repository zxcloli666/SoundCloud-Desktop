use tauri::Emitter;

use crate::rt::AppHandle;

#[derive(serde::Serialize, Clone, Default)]
pub struct Progress {
    pub stage: &'static str,
    pub title: String,
    pub total: usize,
    pub current: usize,
    pub found: usize,
    pub not_found: usize,
    pub errors: usize,
    pub partial: bool,
}

#[derive(serde::Serialize, Clone)]
pub struct Row {
    pub position: usize,
    pub artist: String,
    pub title: String,
    pub urn: Option<String>,
}

#[derive(serde::Serialize, Clone)]
pub struct Chunk {
    pub rows: Vec<Row>,
}

impl Progress {
    pub fn emit(&self, app: &AppHandle) {
        app.emit("import:progress", self).ok();
    }
}

impl Chunk {
    pub fn emit(&self, app: &AppHandle) {
        app.emit("import:chunk", self).ok();
    }
}

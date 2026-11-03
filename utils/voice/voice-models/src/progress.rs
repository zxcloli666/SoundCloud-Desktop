#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Progress {
    pub model: String,
    pub file: String,
    pub file_done: u64,
    pub file_total: u64,
    pub model_done: u64,
    pub model_total: u64,
}

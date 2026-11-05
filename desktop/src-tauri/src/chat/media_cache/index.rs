use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::SystemTime;

#[derive(Default)]
pub struct Index {
    loaded: bool,
    entries: HashMap<String, Entry>,
    total: u64,
}

struct Entry {
    size: u64,
    used: SystemTime,
}

impl Index {
    pub fn empty() -> Self {
        Self {
            loaded: true,
            ..Self::default()
        }
    }

    pub fn scan(dir: &Path, tmp: &str) -> Self {
        let mut index = Self::empty();
        let Ok(entries) = fs::read_dir(dir) else {
            return index;
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            let Ok(meta) = entry.metadata() else {
                continue;
            };
            if !meta.is_file() {
                continue;
            }
            if name.ends_with(tmp) {
                let _ = fs::remove_file(entry.path());
                continue;
            }
            let used = meta.modified().unwrap_or(SystemTime::UNIX_EPOCH);
            index.insert(name, meta.len(), used);
        }
        index
    }

    pub fn loaded(&self) -> bool {
        self.loaded
    }

    pub fn has(&self, name: &str) -> bool {
        self.entries.contains_key(name)
    }

    pub fn total(&self) -> u64 {
        self.total
    }

    pub fn names(&self) -> Vec<String> {
        self.entries.keys().cloned().collect()
    }

    pub fn insert(&mut self, name: String, size: u64, used: SystemTime) {
        self.remove(&name);
        self.total += size;
        self.entries.insert(name, Entry { size, used });
    }

    pub fn used(&mut self, name: &str, at: SystemTime) {
        if let Some(entry) = self.entries.get_mut(name) {
            entry.used = at;
        }
    }

    pub fn remove(&mut self, name: &str) {
        if let Some(entry) = self.entries.remove(name) {
            self.total = self.total.saturating_sub(entry.size);
        }
    }

    pub fn evict(&mut self, cap: u64, keep: &str) -> Vec<String> {
        if self.total <= cap {
            return Vec::new();
        }
        let mut oldest = self
            .entries
            .iter()
            .filter(|(name, _)| name.as_str() != keep)
            .map(|(name, entry)| (entry.used, name.clone()))
            .collect::<Vec<_>>();
        oldest.sort();
        let mut evicted = Vec::new();
        for (_, name) in oldest {
            if self.total <= cap {
                break;
            }
            self.remove(&name);
            evicted.push(name);
        }
        evicted
    }
}

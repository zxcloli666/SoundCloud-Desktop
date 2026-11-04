use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

const KEPT: Duration = Duration::from_secs(600);

#[derive(Default)]
pub struct Picked {
    dropped: Mutex<HashMap<PathBuf, Instant>>,
}

impl Picked {
    pub fn drop_in(&self, paths: &[PathBuf]) {
        let now = Instant::now();
        let Ok(mut dropped) = self.dropped.lock() else {
            return;
        };
        dropped.retain(|_, at| now.duration_since(*at) < KEPT);
        for path in paths {
            if let Ok(path) = path.canonicalize()
                && path.is_file()
            {
                dropped.insert(path, now);
            }
        }
    }

    pub async fn holds(&self, path: &Path) -> bool {
        let Ok(path) = tokio::fs::canonicalize(path).await else {
            return false;
        };
        self.dropped
            .lock()
            .is_ok_and(|dropped| dropped.get(&path).is_some_and(|at| at.elapsed() < KEPT))
    }
}

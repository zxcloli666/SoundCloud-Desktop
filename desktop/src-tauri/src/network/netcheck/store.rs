use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::model::{NetReport, REPORT_VERSION};

const FILE: &str = "netcheck.json";
const MAX_REPORTS: usize = 5;
const MAX_BYTES: usize = 256 * 1024;

#[derive(Default, Serialize, Deserialize)]
struct Stored {
    #[serde(default)]
    reports: Vec<NetReport>,
}

pub fn path(data_dir: &Path) -> PathBuf {
    data_dir.join(FILE)
}

pub async fn load(path: &Path) -> Vec<NetReport> {
    let Ok(bytes) = tokio::fs::read(path).await else {
        return Vec::new();
    };
    serde_json::from_slice::<Stored>(&bytes)
        .map(|stored| stored.reports)
        .unwrap_or_default()
        .into_iter()
        .filter(|report| report.version == REPORT_VERSION)
        .take(MAX_REPORTS)
        .collect()
}

pub fn bounded(mut reports: Vec<NetReport>) -> (Vec<NetReport>, Vec<u8>) {
    reports.truncate(MAX_REPORTS);
    loop {
        let bytes = serde_json::to_vec(&Stored {
            reports: reports.clone(),
        })
        .unwrap_or_default();
        if bytes.len() <= MAX_BYTES || reports.len() <= 1 {
            return (reports, bytes);
        }
        reports.pop();
    }
}

pub async fn save(path: &Path, bytes: Vec<u8>) {
    let tmp = path.with_extension("tmp");
    if tokio::fs::write(&tmp, &bytes).await.is_ok() && tokio::fs::rename(&tmp, path).await.is_err()
    {
        let _ = tokio::fs::remove_file(&tmp).await;
    }
}

#[cfg(test)]
mod tests {
    use super::{MAX_BYTES, MAX_REPORTS, bounded, load, save};
    use crate::network::netcheck::fixture::sample;

    #[test]
    fn only_the_five_newest_reports_are_kept() {
        let reports: Vec<_> = (0..8).map(sample).collect();
        let (kept, bytes) = bounded(reports);
        assert_eq!(kept.len(), MAX_REPORTS);
        assert_eq!(kept[0].at_ms, 0);
        assert!(bytes.len() <= MAX_BYTES);
    }

    #[test]
    fn oversized_reports_drop_the_oldest() {
        let reports: Vec<_> = (0..3)
            .map(|at| {
                let mut report = sample(at);
                report.reason = Some("x".repeat(MAX_BYTES / 2));
                report
            })
            .collect();
        let (kept, bytes) = bounded(reports);
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0].at_ms, 0);
        assert!(!bytes.is_empty());
    }

    #[tokio::test]
    async fn a_saved_store_loads_back() {
        let dir = std::env::temp_dir().join(format!("sc-netcheck-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir_all(&dir).await.unwrap();
        let path = dir.join("netcheck.json");
        let (_, bytes) = bounded(vec![sample(2), sample(1)]);
        save(&path, bytes).await;
        let loaded = load(&path).await;
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[0].at_ms, 2);
        tokio::fs::write(&path, b"{not json").await.unwrap();
        assert!(load(&path).await.is_empty());
        tokio::fs::remove_dir_all(&dir).await.unwrap();
    }
}

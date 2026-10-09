use std::fs::{FileTimes, Metadata, OpenOptions};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

pub struct CachedFile {
    pub path: PathBuf,
    pub size: u64,
    pub last_used: SystemTime,
}

pub fn mark_used(path: &Path) {
    let times = FileTimes::new().set_accessed(SystemTime::now());
    let _ = OpenOptions::new()
        .write(true)
        .open(path)
        .and_then(|file| file.set_times(times));
}

pub fn last_used(meta: &Metadata) -> SystemTime {
    let accessed = meta.accessed().ok();
    let modified = meta.modified().ok();
    accessed
        .max(modified)
        .unwrap_or(SystemTime::UNIX_EPOCH)
}

pub fn collect_files(dirs: &[&Path]) -> Vec<CachedFile> {
    let mut files = Vec::new();
    let mut stack: Vec<PathBuf> = dirs.iter().map(|d| d.to_path_buf()).collect();
    while let Some(dir) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let Ok(meta) = entry.metadata() else {
                continue;
            };
            if meta.is_dir() {
                stack.push(entry.path());
            } else if meta.is_file() {
                files.push(CachedFile {
                    path: entry.path(),
                    size: meta.len(),
                    last_used: last_used(&meta),
                });
            }
        }
    }
    files
}

pub fn trim_to_limit(mut files: Vec<CachedFile>, limit_bytes: u64) -> u64 {
    let mut total: u64 = files.iter().map(|f| f.size).sum();
    if total <= limit_bytes {
        return 0;
    }
    let before = total;
    files.sort_by_key(|f| f.last_used);
    for file in files {
        if total <= limit_bytes {
            break;
        }
        if std::fs::remove_file(&file.path).is_ok() {
            total -= file.size;
        }
    }
    before - total
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("file-lru-{name}-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("ab")).unwrap();
        dir
    }

    fn write_aged(path: &Path, size: usize, age_secs: u64) {
        std::fs::write(path, vec![0u8; size]).unwrap();
        let at = SystemTime::now() - Duration::from_secs(age_secs);
        let times = FileTimes::new().set_accessed(at).set_modified(at);
        std::fs::File::options()
            .write(true)
            .open(path)
            .unwrap()
            .set_times(times)
            .unwrap();
    }

    #[test]
    fn trimming_drops_the_least_recently_used_files_first() {
        let dir = temp_dir("trim");
        let oldest = dir.join("ab").join("oldest");
        let used = dir.join("ab").join("used");
        let newest = dir.join("newest");
        write_aged(&oldest, 100, 300);
        write_aged(&used, 100, 200);
        write_aged(&newest, 100, 100);
        mark_used(&used);

        let freed = trim_to_limit(collect_files(&[&dir]), 200);

        assert_eq!(freed, 100);
        assert!(!oldest.exists());
        assert!(used.exists());
        assert!(newest.exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn marking_a_file_used_keeps_its_modification_time() {
        let dir = temp_dir("mark");
        let path = dir.join("file");
        write_aged(&path, 10, 500);
        let modified = std::fs::metadata(&path).unwrap().modified().unwrap();

        mark_used(&path);

        let meta = std::fs::metadata(&path).unwrap();
        assert_eq!(meta.modified().unwrap(), modified);
        assert!(last_used(&meta) > modified);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn nothing_is_removed_under_the_limit() {
        let dir = temp_dir("under");
        let path = dir.join("file");
        write_aged(&path, 10, 10);

        assert_eq!(trim_to_limit(collect_files(&[&dir]), 100), 0);
        assert!(path.exists());
        std::fs::remove_dir_all(&dir).ok();
    }
}

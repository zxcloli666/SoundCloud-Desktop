use std::path::Path;

use crate::shared::file_lru::{CachedFile, collect_files, trim_to_limit};

pub fn sweep_parts(dir: &Path) {
    for file in collect_files(&[dir]) {
        if !is_video(&file.path) {
            std::fs::remove_file(&file.path).ok();
        }
    }
}

pub fn size(dir: &Path) -> u64 {
    videos(dir).iter().map(|file| file.size).sum()
}

pub fn clear(dir: &Path) -> u32 {
    videos(dir)
        .iter()
        .filter(|file| std::fs::remove_file(&file.path).is_ok())
        .count() as u32
}

pub fn enforce_limit(dir: &Path, limit_mb: u64) -> u64 {
    if limit_mb == 0 {
        return 0;
    }
    trim_to_limit(videos(dir), limit_mb * 1024 * 1024)
}

fn videos(dir: &Path) -> Vec<CachedFile> {
    collect_files(&[dir])
        .into_iter()
        .filter(|file| is_video(&file.path))
        .collect()
}

fn is_video(path: &Path) -> bool {
    path.extension().is_some_and(|ext| ext == "mp4")
}

#[cfg(test)]
mod tests {
    use std::fs::FileTimes;
    use std::path::PathBuf;
    use std::time::{Duration, SystemTime};

    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("video-lru-{name}-{}", std::process::id()));
        std::fs::remove_dir_all(&dir).ok();
        std::fs::create_dir_all(&dir).unwrap();
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
    fn the_oldest_videos_go_first_over_the_quota() {
        let dir = temp_dir("quota");
        let mb = 1024 * 1024;
        write_aged(&dir.join("old.mp4"), mb, 300);
        write_aged(&dir.join("mid.mp4"), mb, 200);
        write_aged(&dir.join("new.mp4"), mb, 100);

        let freed = enforce_limit(&dir, 2);

        assert_eq!(freed, mb as u64);
        assert!(!dir.join("old.mp4").exists());
        assert!(dir.join("mid.mp4").exists());
        assert!(dir.join("new.mp4").exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_part_left_by_a_broken_run_is_swept_and_never_counted() {
        let dir = temp_dir("part");
        write_aged(&dir.join("done.mp4"), 10, 10);
        write_aged(&dir.join("broken.part"), 40, 10);

        assert_eq!(size(&dir), 10);
        sweep_parts(&dir);

        assert!(!dir.join("broken.part").exists());
        assert!(dir.join("done.mp4").exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn clearing_removes_only_videos() {
        let dir = temp_dir("clear");
        write_aged(&dir.join("a.mp4"), 10, 10);
        write_aged(&dir.join("b.mp4"), 10, 10);

        assert_eq!(clear(&dir), 2);
        assert_eq!(size(&dir), 0);
        std::fs::remove_dir_all(&dir).ok();
    }
}

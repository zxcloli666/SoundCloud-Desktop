use std::path::{Path, PathBuf};
use std::time::SystemTime;

use crate::shared::file_lru::last_used;

use super::{
    TrackCacheState, filename_to_urn, is_audio_cache_file, read_cache_metadata,
    remove_cache_metadata,
};

struct EvictableFile {
    path: PathBuf,
    urn: Option<String>,
    size: u64,
    last_used: SystemTime,
}

impl TrackCacheState {
    fn evictable_files(&self) -> Vec<EvictableFile> {
        let in_flight = self
            .transcoding
            .lock()
            .map(|s| s.clone())
            .unwrap_or_default();

        let mut files = Vec::new();
        for dir in [&self.audio_dir, &self.incoming_dir] {
            let is_incoming = *dir == self.incoming_dir;
            let Ok(entries) = std::fs::read_dir(dir) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if !is_audio_cache_file(&path) {
                    continue;
                }
                let urn = filename_to_urn(&entry.file_name().to_string_lossy());
                if is_incoming {
                    if urn.as_ref().is_some_and(|urn| in_flight.contains(urn)) {
                        continue;
                    }
                    if read_cache_metadata(&path).is_some_and(|m| m.liked) {
                        continue;
                    }
                }
                let Ok(meta) = entry.metadata() else {
                    continue;
                };
                if !meta.is_file() {
                    continue;
                }
                files.push(EvictableFile {
                    path,
                    urn,
                    size: meta.len(),
                    last_used: last_used(&meta),
                });
            }
        }
        files
    }

    pub fn enforce_limit(&self, limit_mb: u64) {
        if limit_mb > 0 {
            self.enforce_limit_bytes(limit_mb * 1024 * 1024);
        }
    }

    fn enforce_limit_bytes(&self, limit_bytes: u64) {
        let mut files = self.evictable_files();
        let mut total: u64 = files.iter().map(|f| f.size).sum();
        if total <= limit_bytes {
            return;
        }

        let before = total;
        files.sort_by_key(|f| f.last_used);
        let mut removed = 0u32;
        for file in files {
            if total <= limit_bytes {
                break;
            }
            if remove_audio_file(&file.path) {
                total -= file.size;
                removed += 1;
            }
        }
        println!(
            "[TrackCache] evicted {removed} files, freed {} MB",
            (before - total) / (1024 * 1024)
        );
    }

    pub fn purge_played(&self, keep: Option<&str>) -> u32 {
        let removed = self
            .evictable_files()
            .into_iter()
            .filter(|f| keep.is_none() || f.urn.as_deref() != keep)
            .filter(|f| remove_audio_file(&f.path))
            .count() as u32;
        if removed > 0 {
            println!("[TrackCache] cache off: removed {removed} played files");
        }
        removed
    }
}

fn remove_audio_file(path: &Path) -> bool {
    if std::fs::remove_file(path).is_err() {
        return false;
    }
    remove_cache_metadata(path);
    true
}

#[cfg(test)]
mod tests {
    use std::fs::FileTimes;
    use std::time::{Duration, SystemTime};

    use super::super::MIN_AUDIO_SIZE;
    use super::super::tests::test_state;

    fn write_file(path: &std::path::Path) {
        std::fs::write(path, vec![0u8; MIN_AUDIO_SIZE as usize]).unwrap();
    }

    fn age(path: &std::path::Path, secs: u64) {
        let at = SystemTime::now() - Duration::from_secs(secs);
        let times = FileTimes::new().set_accessed(at).set_modified(at);
        std::fs::File::options()
            .write(true)
            .open(path)
            .unwrap()
            .set_times(times)
            .unwrap();
    }

    #[test]
    fn limit_evicts_the_least_recently_played_track() {
        let (root, state) = test_state("lru");
        let replayed = "soundcloud:tracks:30";
        let forgotten = "soundcloud:tracks:31";
        write_file(&state.file_path(replayed));
        write_file(&state.file_path(forgotten));
        age(&state.file_path(replayed), 600);
        age(&state.file_path(forgotten), 300);

        state.mark_played(replayed);
        state.enforce_limit_bytes(MIN_AUDIO_SIZE);

        assert!(state.file_path(replayed).exists());
        assert!(!state.file_path(forgotten).exists());
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn purge_keeps_the_current_track_and_protected_files() {
        let (root, state) = test_state("purge");
        let current = "soundcloud:tracks:10";
        let played = "soundcloud:tracks:11";
        let staged = "soundcloud:tracks:12";
        let liked = "soundcloud:tracks:13";
        let transcoding = "soundcloud:tracks:14";
        write_file(&state.file_path(current));
        write_file(&state.file_path(played));
        write_file(&state.incoming_file_path(staged));
        write_file(&state.liked_file_path(liked));
        write_file(&state.incoming_file_path(transcoding));
        state
            .transcoding
            .lock()
            .unwrap()
            .insert(transcoding.to_string());

        assert_eq!(state.purge_played(Some(current)), 2);

        assert!(state.file_path(current).exists());
        assert!(!state.file_path(played).exists());
        assert!(!state.incoming_file_path(staged).exists());
        assert!(state.liked_file_path(liked).exists());
        assert!(state.incoming_file_path(transcoding).exists());
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn purge_without_a_current_track_clears_everything_unprotected() {
        let (root, state) = test_state("purge-all");
        let played = "soundcloud:tracks:20";
        let liked = "soundcloud:tracks:21";
        write_file(&state.file_path(played));
        write_file(&state.liked_file_path(liked));

        assert_eq!(state.purge_played(None), 1);

        assert!(!state.file_path(played).exists());
        assert!(state.liked_file_path(liked).exists());
        std::fs::remove_dir_all(&root).ok();
    }
}

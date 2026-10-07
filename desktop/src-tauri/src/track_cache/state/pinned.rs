use std::path::Path;

use crate::shared::file_lru::mark_used;

use super::{TrackCacheEntry, TrackCacheMetadata, TrackCacheState, read_cache_metadata};

impl TrackCacheState {
    pub(super) fn entry_at(
        &self,
        path: &Path,
        meta: Option<TrackCacheMetadata>,
    ) -> TrackCacheEntry {
        let pinned = self.is_pinned_path(path, meta.as_ref());
        TrackCacheEntry::from_path_and_meta(path, meta, pinned)
    }

    fn is_pinned_path(&self, path: &Path, meta: Option<&TrackCacheMetadata>) -> bool {
        path.starts_with(&self.liked_dir) || meta.is_some_and(|m| m.liked)
    }

    pub fn is_pinned(&self, urn: &str) -> bool {
        self.resolve_path(urn)
            .is_some_and(|path| self.is_pinned_path(&path, read_cache_metadata(&path).as_ref()))
    }

    pub fn mark_played(&self, urn: &str) {
        if let Some(path) = self.resolve_path(urn) {
            mark_used(&path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::MIN_AUDIO_SIZE;
    use super::super::tests::test_state;

    #[test]
    fn only_protected_files_count_as_pinned() {
        let (root, state) = test_state("pinned");
        let played = "soundcloud:tracks:40";
        let saved = "soundcloud:tracks:41";
        let missing = "soundcloud:tracks:42";
        std::fs::write(state.file_path(played), vec![0u8; MIN_AUDIO_SIZE as usize]).unwrap();
        std::fs::write(
            state.liked_file_path(saved),
            vec![0u8; MIN_AUDIO_SIZE as usize],
        )
        .unwrap();

        assert!(!state.get_cache_entry(played).unwrap().pinned);
        assert!(state.get_cache_entry(saved).unwrap().pinned);
        assert!(!state.is_pinned(played));
        assert!(state.is_pinned(saved));
        assert!(!state.is_pinned(missing));
        std::fs::remove_dir_all(&root).ok();
    }
}

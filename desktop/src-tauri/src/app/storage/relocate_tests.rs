use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use super::*;
use crate::app::storage::{StorageLocation, config};

struct TempRoot(PathBuf);

impl TempRoot {
    fn new() -> Self {
        let dir = std::env::temp_dir().join(format!("scd-relocate-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        Self(dir)
    }
}

impl Drop for TempRoot {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.0).ok();
    }
}

fn write(path: &Path, bytes: &[u8]) {
    std::fs::write(path, bytes).unwrap();
}

#[test]
fn picked_folder_gets_its_own_subfolder_once() {
    let picked = Path::new("/mnt/music");
    assert_eq!(root_for_pick(picked), picked.join(ROOT_FOLDER));
    let again = picked.join(ROOT_FOLDER);
    assert_eq!(root_for_pick(&again), again);
}

#[test]
fn rejects_same_nested_and_missing_targets() {
    let tmp = TempRoot::new();
    let active = tmp.0.join("active");
    AudioDirs::under(&active).create().unwrap();

    assert_eq!(validate_target(&active, &active), Err(RelocateError::Same));
    assert_eq!(
        validate_target(&active, &active.join("audio_liked").join(ROOT_FOLDER)),
        Err(RelocateError::Nested)
    );
    assert_eq!(validate_target(&active, &tmp.0), Err(RelocateError::Nested));
    assert_eq!(
        validate_target(&active, &tmp.0.join("gone").join(ROOT_FOLDER)),
        Err(RelocateError::Missing)
    );
    assert_eq!(validate_target(&active, &tmp.0.join(ROOT_FOLDER)), Ok(()));
}

#[test]
fn copies_only_cache_files_and_keeps_their_play_time() {
    let tmp = TempRoot::new();
    let from = AudioDirs::under(&tmp.0.join("from"));
    from.create().unwrap();
    let liked = from.liked.join("soundcloud_tracks_1.audio");
    write(&liked, b"liked-bytes");
    write(
        &from.liked.join("soundcloud_tracks_1.audio.meta.json"),
        b"{}",
    );
    write(&from.audio.join("soundcloud_tracks_2.audio"), b"plain");
    write(
        &from.incoming.join("soundcloud_tracks_3.audio.part"),
        b"partial",
    );
    write(&from.audio.join("notes.txt"), b"foreign");
    let played = SystemTime::now() - Duration::from_secs(86_400);
    std::fs::File::options()
        .write(true)
        .open(&liked)
        .unwrap()
        .set_times(
            std::fs::FileTimes::new()
                .set_accessed(played)
                .set_modified(played),
        )
        .unwrap();

    let to = prepare_target(&tmp.0.join("to")).unwrap();
    let mut last = Progress::default();
    copy_cache(&from, &to, |p| last = p).unwrap();

    assert_eq!(last.total_files, 3);
    assert_eq!(last.files, 3);
    assert_eq!(last.bytes, last.total_bytes);
    assert_eq!(
        std::fs::read(to.liked.join("soundcloud_tracks_1.audio")).unwrap(),
        b"liked-bytes"
    );
    assert!(
        to.liked
            .join("soundcloud_tracks_1.audio.meta.json")
            .is_file()
    );
    assert!(to.audio.join("soundcloud_tracks_2.audio").is_file());
    assert!(!to.incoming.join("soundcloud_tracks_3.audio.part").exists());
    assert!(!to.audio.join("notes.txt").exists());
    let copied = std::fs::metadata(to.liked.join("soundcloud_tracks_1.audio")).unwrap();
    assert_eq!(copied.modified().unwrap(), played);
}

#[test]
fn cleanup_keeps_foreign_files() {
    let tmp = TempRoot::new();
    let dirs = AudioDirs::under(&tmp.0);
    dirs.create().unwrap();
    write(&dirs.audio.join("soundcloud_tracks_2.audio"), b"plain");
    write(
        &dirs.incoming.join("soundcloud_tracks_3.audio.part"),
        b"partial",
    );
    write(&dirs.liked.join("keep.txt"), b"mine");

    remove_cache_files(&dirs);

    assert!(!dirs.audio.exists());
    assert!(!dirs.incoming.exists());
    assert!(dirs.liked.join("keep.txt").is_file());
}

#[test]
fn rescue_moves_only_missing_saved_tracks() {
    let tmp = TempRoot::new();
    let from = AudioDirs::under(&tmp.0.join("fallback"));
    let to = AudioDirs::under(&tmp.0.join("drive"));
    from.create().unwrap();
    to.create().unwrap();
    write(
        &from.liked.join("soundcloud_tracks_1.audio"),
        b"saved-offline",
    );
    write(&from.liked.join("soundcloud_tracks_2.audio"), b"older");
    write(&to.liked.join("soundcloud_tracks_2.audio"), b"newer");
    write(&from.audio.join("soundcloud_tracks_3.audio"), b"played");

    rescue_saved(&from, &to);

    assert_eq!(
        std::fs::read(to.liked.join("soundcloud_tracks_1.audio")).unwrap(),
        b"saved-offline"
    );
    assert_eq!(
        std::fs::read(to.liked.join("soundcloud_tracks_2.audio")).unwrap(),
        b"newer"
    );
    assert!(!to.audio.join("soundcloud_tracks_3.audio").exists());
}

#[test]
fn fallback_root_is_cleaned_once_the_drive_returns() {
    let tmp = TempRoot::new();
    let default_root = tmp.0.join("default");
    let data_dir = tmp.0.join("data");
    let drive = tmp.0.join("drive");
    let config_path = config::config_path(&data_dir);
    config::save(
        &config_path,
        &config::LocationConfig {
            audio_root: Some(drive.clone()),
            stale_roots: Vec::new(),
        },
    )
    .unwrap();

    let offline = StorageLocation::init(&default_root, &data_dir);
    assert!(offline.is_unavailable());
    let fallback = offline.audio_dirs();
    write(&fallback.audio.join("soundcloud_tracks_1.audio"), b"played");
    write(&fallback.liked.join("soundcloud_tracks_2.audio"), b"saved");
    offline.sweep_stale_roots();
    assert!(fallback.audio.join("soundcloud_tracks_1.audio").is_file());

    std::fs::create_dir_all(&drive).unwrap();
    let back = StorageLocation::init(&default_root, &data_dir);
    assert!(!back.is_unavailable());
    back.sweep_stale_roots();

    assert!(!fallback.audio.exists());
    assert!(
        back.audio_dirs()
            .liked
            .join("soundcloud_tracks_2.audio")
            .is_file()
    );
    assert!(config::load(&config_path).stale_roots.is_empty());
}

use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime};

use uuid::Uuid;

use super::{MediaCache, name};
use crate::chat::download::Part;

struct Dir(PathBuf);

impl Dir {
    fn new() -> Self {
        let dir =
            std::env::temp_dir().join(format!("chat-media-cache-{}", Uuid::new_v4().simple()));
        fs::create_dir_all(&dir).unwrap();
        Self(dir)
    }

    fn files(&self) -> Vec<String> {
        let mut names = fs::read_dir(self.0.join("media"))
            .map(|entries| {
                entries
                    .flatten()
                    .map(|entry| entry.file_name().to_string_lossy().into_owned())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        names.sort();
        names
    }
}

impl Drop for Dir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn age(cache: &MediaCache, media_id: Uuid, part: Part, seconds: u64) {
    let path = cache.dir().join(name(media_id, part));
    let at = SystemTime::now() - Duration::from_secs(seconds);
    let file = fs::File::options().write(true).open(path).unwrap();
    file.set_times(fs::FileTimes::new().set_modified(at))
        .unwrap();
}

#[test]
fn a_put_reads_back_and_leaves_no_temp_file() {
    let dir = Dir::new();
    let cache = MediaCache::open(&dir.0);
    let id = Uuid::new_v4();

    cache.put(id, Part::Image, b"sealed image").unwrap();
    cache.put(id, Part::Thumb, b"sealed thumb").unwrap();

    assert_eq!(
        cache.get(id, Part::Image).unwrap(),
        Some(b"sealed image".to_vec())
    );
    assert_eq!(
        cache.get(id, Part::Thumb).unwrap(),
        Some(b"sealed thumb".to_vec())
    );
    assert_eq!(cache.get(Uuid::new_v4(), Part::Image).unwrap(), None);
    assert_eq!(cache.size().unwrap(), 24);
    assert_eq!(dir.files(), {
        let mut names = vec![name(id, Part::Image), name(id, Part::Thumb)];
        names.sort();
        names
    });
}

#[test]
fn a_put_replaces_the_old_bytes_and_size() {
    let dir = Dir::new();
    let cache = MediaCache::open(&dir.0);
    let id = Uuid::new_v4();

    cache.put(id, Part::Image, &[1; 100]).unwrap();
    cache.put(id, Part::Image, &[2; 40]).unwrap();

    assert_eq!(cache.get(id, Part::Image).unwrap(), Some(vec![2; 40]));
    assert_eq!(cache.size().unwrap(), 40);
}

#[test]
fn a_restart_finds_the_files_and_drops_crash_leftovers() {
    let dir = Dir::new();
    let id = Uuid::new_v4();
    MediaCache::open(&dir.0)
        .put(id, Part::Image, &[7; 300])
        .unwrap();
    let leftover = dir
        .0
        .join("media")
        .join(format!("{}.abc.tmp", name(id, Part::Thumb)));
    fs::write(&leftover, [9; 50]).unwrap();

    let reopened = MediaCache::open(&dir.0);

    assert_eq!(reopened.size().unwrap(), 300);
    assert!(!leftover.exists());
    assert_eq!(reopened.get(id, Part::Image).unwrap(), Some(vec![7; 300]));
    assert_eq!(reopened.get(id, Part::Thumb).unwrap(), None);
}

#[test]
fn the_cap_evicts_the_least_recently_used_first() {
    let dir = Dir::new();
    let (old, used, fresh) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
    let seeded = MediaCache::open(&dir.0);
    seeded.put(old, Part::Image, &[1; 400]).unwrap();
    seeded.put(used, Part::Image, &[2; 400]).unwrap();
    age(&seeded, old, Part::Image, 300);
    age(&seeded, used, Part::Image, 200);
    let cache = MediaCache::with_cap(&dir.0, 1000);
    assert!(cache.get(used, Part::Image).unwrap().is_some());

    cache.put(fresh, Part::Image, &[3; 400]).unwrap();

    assert_eq!(cache.get(old, Part::Image).unwrap(), None);
    assert!(cache.get(used, Part::Image).unwrap().is_some());
    assert!(cache.get(fresh, Part::Image).unwrap().is_some());
    assert_eq!(cache.size().unwrap(), 800);
    assert_eq!(dir.files().len(), 2);
}

#[test]
fn an_entry_bigger_than_the_cap_stays_until_the_next_put() {
    let dir = Dir::new();
    let cache = MediaCache::with_cap(&dir.0, 100);
    let (big, next) = (Uuid::new_v4(), Uuid::new_v4());

    cache.put(big, Part::Image, &[1; 400]).unwrap();
    assert!(cache.get(big, Part::Image).unwrap().is_some());
    cache.put(next, Part::Thumb, &[2; 50]).unwrap();

    assert_eq!(cache.get(big, Part::Image).unwrap(), None);
    assert_eq!(cache.size().unwrap(), 50);
}

#[test]
fn forget_drops_every_part_of_one_media() {
    let dir = Dir::new();
    let cache = MediaCache::open(&dir.0);
    let (gone, kept) = (Uuid::new_v4(), Uuid::new_v4());
    cache.put(gone, Part::Image, &[1; 10]).unwrap();
    cache.put(gone, Part::Thumb, &[1; 5]).unwrap();
    cache.put(kept, Part::Image, &[2; 7]).unwrap();

    cache.forget(gone).unwrap();

    assert_eq!(cache.get(gone, Part::Image).unwrap(), None);
    assert_eq!(cache.get(gone, Part::Thumb).unwrap(), None);
    assert_eq!(cache.size().unwrap(), 7);
    assert_eq!(dir.files(), vec![name(kept, Part::Image)]);
}

#[test]
fn a_file_removed_behind_the_cache_reads_as_a_miss() {
    let dir = Dir::new();
    let cache = MediaCache::open(&dir.0);
    let id = Uuid::new_v4();
    cache.put(id, Part::Image, &[1; 10]).unwrap();
    fs::remove_file(cache.dir().join(name(id, Part::Image))).unwrap();

    assert_eq!(cache.get(id, Part::Image).unwrap(), None);
    assert_eq!(cache.size().unwrap(), 0);
}

#[test]
fn clear_empties_the_folder_and_reports_what_it_freed() {
    let dir = Dir::new();
    let cache = MediaCache::open(&dir.0);
    cache.put(Uuid::new_v4(), Part::Image, &[1; 10]).unwrap();
    cache.put(Uuid::new_v4(), Part::Thumb, &[1; 6]).unwrap();

    assert_eq!(cache.clear().unwrap(), 16);
    assert_eq!(cache.size().unwrap(), 0);
    assert!(dir.files().is_empty());
    assert_eq!(MediaCache::open(&dir.0).size().unwrap(), 0);
}

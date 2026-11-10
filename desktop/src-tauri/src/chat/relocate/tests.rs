use std::cell::Cell;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use uuid::Uuid;

use super::{Disk, MOVED, Moved, RealDisk, relocate, settle};

struct Scratch(PathBuf);

impl Scratch {
    fn new() -> Self {
        Self::under(&std::env::temp_dir())
    }

    fn under(base: &Path) -> Self {
        let dir = base.join(format!("sc-chat-relocate-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        Self(dir)
    }

    fn roaming(&self) -> PathBuf {
        self.0.join("Roaming").join("app").join(crate::chat::DIR)
    }

    fn local(&self) -> PathBuf {
        self.0.join("Local").join("app").join(crate::chat::DIR)
    }

    fn staging(&self) -> PathBuf {
        self.local()
            .with_file_name(format!("{}.moving", crate::chat::DIR))
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

struct OtherVolume {
    copies: Cell<usize>,
    fail_at: Option<usize>,
}

impl OtherVolume {
    fn new() -> Self {
        Self {
            copies: Cell::new(0),
            fail_at: None,
        }
    }

    fn failing_at(copy: usize) -> Self {
        Self {
            copies: Cell::new(0),
            fail_at: Some(copy),
        }
    }
}

impl Disk for OtherVolume {
    fn rename(&self, _from: &Path, _to: &Path) -> io::Result<()> {
        Err(io::Error::from(io::ErrorKind::CrossesDevices))
    }

    fn copy(&self, from: &Path, to: &Path) -> io::Result<()> {
        let copy = self.copies.get() + 1;
        self.copies.set(copy);
        if self.fail_at == Some(copy) {
            fs::write(to, b"half")?;
            return Err(io::Error::other("disk full"));
        }
        fs::copy(from, to).map(drop)
    }
}

fn chat_folder(dir: &Path) {
    fs::create_dir_all(dir.join("deletes")).unwrap();
    fs::create_dir_all(dir.join("uploads")).unwrap();
    fs::create_dir_all(dir.join("media").join("empty")).unwrap();
    fs::write(dir.join("chat.db"), vec![7u8; 300_000]).unwrap();
    fs::write(dir.join("notify.json"), b"{\"enabled\":true}").unwrap();
    fs::write(dir.join("deletes").join("313030.json"), b"[\"a\",\"b\"]").unwrap();
    fs::write(dir.join("uploads").join("x.img"), vec![1u8; 4096]).unwrap();
}

fn listing(dir: &Path) -> Vec<(String, Vec<u8>)> {
    let mut found = Vec::new();
    walk(dir, dir, &mut found);
    found.sort();
    found
}

fn walk(root: &Path, dir: &Path, found: &mut Vec<(String, Vec<u8>)>) {
    for entry in fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path();
        let name = path
            .strip_prefix(root)
            .unwrap()
            .to_string_lossy()
            .replace('\\', "/");
        if path.is_dir() {
            found.push((format!("{name}/"), Vec::new()));
            walk(root, &path, found);
        } else if name != MOVED {
            found.push((name, fs::read(&path).unwrap()));
        }
    }
}

fn staging_left(scratch: &Scratch) -> bool {
    scratch.staging().exists()
}

#[test]
fn a_folder_on_the_same_volume_is_renamed_with_its_delete_queue() {
    let scratch = Scratch::new();
    chat_folder(&scratch.roaming());
    let before = listing(&scratch.roaming());
    let moved = relocate(&scratch.roaming(), &scratch.local(), &RealDisk).unwrap();
    assert_eq!(moved, Moved::Renamed);
    assert!(!scratch.roaming().exists());
    assert_eq!(listing(&scratch.local()), before);
    assert!(scratch.local().join("deletes").join("313030.json").exists());
}

#[test]
fn a_folder_on_another_volume_is_copied_verified_and_then_removed() {
    let scratch = Scratch::new();
    chat_folder(&scratch.roaming());
    let before = listing(&scratch.roaming());
    let moved = relocate(&scratch.roaming(), &scratch.local(), &OtherVolume::new()).unwrap();
    assert_eq!(moved, Moved::Copied);
    assert!(!scratch.roaming().exists());
    assert_eq!(listing(&scratch.local()), before);
    assert!(scratch.local().join(MOVED).exists());
    assert!(!staging_left(&scratch));
}

#[test]
fn an_existing_local_folder_is_used_and_the_roaming_one_is_left_alone() {
    let scratch = Scratch::new();
    chat_folder(&scratch.roaming());
    fs::create_dir_all(scratch.local()).unwrap();
    fs::write(scratch.local().join("chat.db"), b"local").unwrap();
    let roaming = listing(&scratch.roaming());
    let moved = relocate(&scratch.roaming(), &scratch.local(), &OtherVolume::new()).unwrap();
    assert_eq!(moved, Moved::OldKept);
    assert_eq!(listing(&scratch.roaming()), roaming);
    assert_eq!(fs::read(scratch.local().join("chat.db")).unwrap(), b"local");
    assert_eq!(
        settle(&scratch.roaming(), &scratch.local(), &RealDisk),
        scratch.local()
    );
}

#[test]
fn a_failure_mid_copy_keeps_the_roaming_folder_whole_and_in_use() {
    let scratch = Scratch::new();
    chat_folder(&scratch.roaming());
    let before = listing(&scratch.roaming());
    let failed = relocate(
        &scratch.roaming(),
        &scratch.local(),
        &OtherVolume::failing_at(2),
    );
    assert!(failed.is_err());
    assert_eq!(listing(&scratch.roaming()), before);
    assert!(!scratch.local().exists());
    assert!(!staging_left(&scratch));
    assert_eq!(
        settle(
            &scratch.roaming(),
            &scratch.local(),
            &OtherVolume::failing_at(1)
        ),
        scratch.roaming()
    );
}

#[test]
fn a_rerun_after_a_failed_copy_moves_everything() {
    let scratch = Scratch::new();
    chat_folder(&scratch.roaming());
    let before = listing(&scratch.roaming());
    assert!(
        relocate(
            &scratch.roaming(),
            &scratch.local(),
            &OtherVolume::failing_at(3)
        )
        .is_err()
    );
    let moved = relocate(&scratch.roaming(), &scratch.local(), &OtherVolume::new()).unwrap();
    assert_eq!(moved, Moved::Copied);
    assert_eq!(listing(&scratch.local()), before);
    assert!(!scratch.roaming().exists());
}

#[test]
fn a_staging_folder_left_by_a_crash_is_replaced() {
    let scratch = Scratch::new();
    chat_folder(&scratch.roaming());
    let staging = scratch.staging();
    fs::create_dir_all(&staging).unwrap();
    fs::write(staging.join("chat.db"), b"torn").unwrap();
    let before = listing(&scratch.roaming());
    let moved = relocate(&scratch.roaming(), &scratch.local(), &OtherVolume::new()).unwrap();
    assert_eq!(moved, Moved::Copied);
    assert_eq!(listing(&scratch.local()), before);
    assert!(!staging.exists());
}

#[test]
fn a_roaming_leftover_goes_on_the_next_start_only_if_nothing_changed_in_it() {
    let scratch = Scratch::new();
    chat_folder(&scratch.roaming());
    relocate(&scratch.roaming(), &scratch.local(), &OtherVolume::new()).unwrap();
    chat_folder(&scratch.roaming());
    let moved = relocate(&scratch.roaming(), &scratch.local(), &RealDisk).unwrap();
    assert_eq!(moved, Moved::Copied);
    assert!(!scratch.roaming().exists());

    chat_folder(&scratch.roaming());
    fs::write(scratch.roaming().join("chat.db"), b"written elsewhere").unwrap();
    let moved = relocate(&scratch.roaming(), &scratch.local(), &RealDisk).unwrap();
    assert_eq!(moved, Moved::OldKept);
    assert_eq!(
        fs::read(scratch.roaming().join("chat.db")).unwrap(),
        b"written elsewhere"
    );
}

#[test]
fn a_half_removed_roaming_leftover_is_cleared_on_the_next_start() {
    let scratch = Scratch::new();
    chat_folder(&scratch.roaming());
    relocate(&scratch.roaming(), &scratch.local(), &OtherVolume::new()).unwrap();
    let before = listing(&scratch.local());

    chat_folder(&scratch.roaming());
    fs::remove_file(scratch.roaming().join("chat.db")).unwrap();
    fs::remove_dir_all(scratch.roaming().join("uploads")).unwrap();
    let moved = relocate(&scratch.roaming(), &scratch.local(), &RealDisk).unwrap();
    assert_eq!(moved, Moved::Copied);
    assert!(!scratch.roaming().exists());
    assert_eq!(listing(&scratch.local()), before);

    chat_folder(&scratch.roaming());
    let unseen = scratch.roaming().join("deletes").join("626262.json");
    fs::write(&unseen, b"[]").unwrap();
    let moved = relocate(&scratch.roaming(), &scratch.local(), &RealDisk).unwrap();
    assert_eq!(moved, Moved::OldKept);
    assert!(unseen.exists());
}

#[test]
#[ignore = "needs CHAT_OTHER_VOLUME, a folder on another volume"]
fn a_folder_on_a_real_other_volume_is_copied_verified_and_then_removed() {
    let scratch = Scratch::new();
    let other = Scratch::under(Path::new(&std::env::var("CHAT_OTHER_VOLUME").unwrap()));
    chat_folder(&scratch.roaming());
    let before = listing(&scratch.roaming());
    let moved = relocate(&scratch.roaming(), &other.local(), &RealDisk).unwrap();
    assert_eq!(
        moved,
        Moved::Copied,
        "{:?} -> {:?}",
        scratch.roaming(),
        other.local()
    );
    assert!(!scratch.roaming().exists());
    assert_eq!(listing(&other.local()), before);
    assert!(other.local().join(MOVED).exists());
    assert!(!staging_left(&other));
}

#[test]
fn a_fresh_install_starts_in_the_local_folder() {
    let scratch = Scratch::new();
    let moved = relocate(&scratch.roaming(), &scratch.local(), &RealDisk).unwrap();
    assert_eq!(moved, Moved::Nothing);
    assert_eq!(
        settle(&scratch.roaming(), &scratch.local(), &RealDisk),
        scratch.local()
    );
}

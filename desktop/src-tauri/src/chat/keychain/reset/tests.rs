use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use sc_chat::crypto::DeviceKeys;
use sc_chat::store::Store;
use sc_chat::{ChatError, ChatResult, DeviceId, KeyName, KeyStorage, KeyStore, Zeroizing};

use super::super::testing::{Broken, Refusing, SharedVault, Sticky};
use super::super::{Keychain, Vault, database_path};
use super::{LATELY_MS, ResetPlan, lately, now_ms};

struct Garbling(SharedVault);

impl Vault for Garbling {
    fn load(&self, name: KeyName) -> ChatResult<Option<Zeroizing<Vec<u8>>>> {
        Ok(self.0.load(name)?.map(|mut secret| {
            secret.push(0);
            secret
        }))
    }

    fn save(&self, name: KeyName, secret: &[u8]) -> ChatResult<()> {
        self.0.save(name, secret)
    }

    fn delete(&self, name: KeyName) -> ChatResult<()> {
        self.0.delete(name)
    }
}

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("sc-chat-reset-{name}-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn chat_on_disk(dir: &Path, vault: &SharedVault) -> DeviceId {
    let keychain = Keychain::with_os(Box::new(vault.clone()), dir);
    let (device, _) = DeviceKeys::load_or_create(&keychain).unwrap();
    let store = Store::open_keyed(&database_path(dir), &keychain).unwrap();
    store.set_me("100").unwrap();
    drop(store);
    fs::write(dir.join("chat.db.orphan-1"), b"older").unwrap();
    fs::create_dir_all(dir.join("media")).unwrap();
    fs::write(dir.join("media").join("a.thumb"), b"photo").unwrap();
    fs::create_dir_all(dir.join("uploads")).unwrap();
    fs::write(dir.join("uploads").join("b.img"), b"photo").unwrap();
    fs::create_dir_all(dir.join("deletes")).unwrap();
    fs::write(dir.join("deletes").join("313030.json"), b"[]").unwrap();
    fs::write(dir.join("notify.json"), b"{}").unwrap();
    device
}

fn assert_cleared(dir: &Path) {
    let left: Vec<String> = fs::read_dir(dir)
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
        .filter(|name| name.starts_with("chat.db") || name == "media" || name == "uploads")
        .collect();
    assert!(left.is_empty(), "{left:?}");
    assert!(dir.join("deletes").join("313030.json").exists());
    assert!(dir.join("notify.json").exists());
}

fn assert_reset(dir: &Path, keychain: &Keychain, storage: KeyStorage) {
    assert_eq!(keychain.storage(), storage);
    assert!(!keychain.denied());
    assert!(dir.join("keys-reset").exists());
    for marker in ["keys-resetting", "keys-stale", "keys-made"] {
        assert!(!dir.join(marker).exists(), "{marker}");
    }
    assert_eq!(dir.join("keys").is_dir(), storage == KeyStorage::File);
    if storage == KeyStorage::File {
        assert_eq!(fs::read_dir(dir.join("keys")).unwrap().count(), 0);
    }
}

fn parked(dir: &Path, vault: &Refusing) -> Keychain {
    let keychain = Keychain::with_os(Box::new(vault.clone()), dir);
    assert_eq!(
        keychain.load(KeyName::Database).err(),
        Some(ChatError::KeychainDenied)
    );
    assert!(keychain.denied());
    keychain
}

#[test]
fn a_reset_from_the_card_never_asks_the_os_and_moves_to_the_file() {
    let dir = scratch("card");
    let old = chat_on_disk(&dir, &SharedVault::default());
    let locked = Refusing::default();
    let keychain = parked(&dir, &locked);

    keychain.reset(ResetPlan::File).unwrap();
    assert_eq!(locked.asked(), 1);
    assert_cleared(&dir);
    assert_reset(&dir, &keychain, KeyStorage::File);

    let (fresh, _) = DeviceKeys::load_or_create(&keychain).unwrap();
    assert_ne!(fresh, old);
    Store::open_keyed(&database_path(&dir), &keychain).unwrap();
    assert_eq!(fs::read_dir(dir.join("keys")).unwrap().count(), 4);
    assert_eq!(locked.asked(), 1);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_reset_keychain_stays_on_the_file_after_a_restart() {
    let dir = scratch("restart");
    chat_on_disk(&dir, &SharedVault::default());
    let locked = Refusing::default();
    let keychain = parked(&dir, &locked);
    keychain.reset(ResetPlan::File).unwrap();
    let (fresh, _) = DeviceKeys::load_or_create(&keychain).unwrap();
    drop(keychain);

    let restarted = Keychain::with_os(Box::new(locked.clone()), &dir);
    assert_eq!(restarted.storage(), KeyStorage::File);
    restarted.sweep().unwrap();
    let (again, _) = DeviceKeys::load_or_create(&restarted).unwrap();
    assert_eq!(again, fresh);
    assert_eq!(locked.asked(), 1);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_local_clear_that_fails_commits_nothing() {
    let dir = scratch("stuck");
    fs::create_dir_all(database_path(&dir)).unwrap();
    fs::write(database_path(&dir).join("held"), b"").unwrap();
    let locked = Refusing::default();
    let keychain = parked(&dir, &locked);

    assert_eq!(
        keychain.reset(ResetPlan::File).err(),
        Some(ChatError::Store)
    );
    assert_eq!(keychain.storage(), KeyStorage::Os);
    assert!(keychain.denied());
    for left in ["keys", "keys-resetting", "keys-reset"] {
        assert!(!dir.join(left).exists(), "{left}");
    }
    keychain.sweep().unwrap();
    assert_eq!(locked.asked(), 1);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn an_interrupted_reset_finishes_at_the_next_sweep() {
    let dir = scratch("interrupted");
    chat_on_disk(&dir, &SharedVault::default());
    fs::write(dir.join("keys-resetting"), "file").unwrap();
    fs::write(dir.join("keys-made"), []).unwrap();
    let locked = Refusing::default();
    let keychain = Keychain::with_os(Box::new(locked.clone()), &dir);

    keychain.sweep().unwrap();
    assert_eq!(locked.asked(), 0);
    assert_cleared(&dir);
    assert_reset(&dir, &keychain, KeyStorage::File);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_reset_cut_short_after_its_commit_finishes_on_the_file() {
    let dir = scratch("committed");
    fs::create_dir_all(dir.join("keys")).unwrap();
    fs::write(dir.join("keys-resetting"), "probe").unwrap();
    fs::write(dir.join("keys-stale"), []).unwrap();
    let locked = Refusing::default();
    let keychain = Keychain::with_os(Box::new(locked.clone()), &dir);
    assert_eq!(keychain.storage(), KeyStorage::File);

    keychain.sweep().unwrap();
    assert_eq!(locked.asked(), 0);
    assert_reset(&dir, &keychain, KeyStorage::File);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_stale_marker_never_deletes_the_new_file_keys() {
    let dir = scratch("stale");
    let locked = Refusing::default();
    let keychain = parked(&dir, &locked);
    assert_eq!(keychain.wipe().err(), Some(ChatError::KeychainDenied));
    assert!(dir.join("keys-stale").exists());

    keychain.reset(ResetPlan::File).unwrap();
    let (fresh, _) = DeviceKeys::load_or_create(&keychain).unwrap();
    keychain.sweep().unwrap();
    let restarted = Keychain::with_os(Box::new(locked.clone()), &dir);
    restarted.sweep().unwrap();
    let (again, _) = DeviceKeys::load_or_create(&restarted).unwrap();
    assert_eq!(again, fresh);
    assert_eq!(locked.asked(), 1);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_reset_while_chats_work_empties_the_os_store_and_stays_there() {
    let dir = scratch("in-place");
    let vault = SharedVault::default();
    let old = chat_on_disk(&dir, &vault);
    let keychain = Keychain::with_os(Box::new(vault.clone()), &dir);
    DeviceKeys::load_or_create(&keychain).unwrap();
    assert!(dir.join("keys-made").exists());

    keychain.reset(ResetPlan::InPlace).unwrap();
    assert_cleared(&dir);
    assert_reset(&dir, &keychain, KeyStorage::Os);
    for name in KeyName::ALL {
        assert!(!vault.holds(name), "{name:?}");
    }
    assert!(keychain.may_fall_back());
    let (fresh, _) = DeviceKeys::load_or_create(&keychain).unwrap();
    assert_ne!(fresh, old);
    assert!(vault.holds(KeyName::DeviceId));
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn an_os_key_left_behind_sends_the_reset_to_the_file() {
    let dir = scratch("left-behind");
    let vault = SharedVault::default();
    chat_on_disk(&dir, &vault);
    let keychain = Keychain::with_os(Box::new(Sticky(vault.clone())), &dir);

    keychain.reset(ResetPlan::InPlace).unwrap();
    assert_cleared(&dir);
    assert_reset(&dir, &keychain, KeyStorage::File);
    assert!(vault.holds(KeyName::DeviceId));
    let (fresh, _) = DeviceKeys::load_or_create(&keychain).unwrap();
    let restarted = Keychain::with_os(Box::new(Sticky(vault.clone())), &dir);
    let (again, _) = DeviceKeys::load_or_create(&restarted).unwrap();
    assert_eq!(again, fresh);
    fs::remove_dir_all(dir).unwrap();
}

#[tokio::test]
async fn a_refusal_during_an_in_place_reset_goes_to_the_file_and_parks_nothing() {
    let dir = scratch("refused-in-place");
    chat_on_disk(&dir, &SharedVault::default());
    let locked = Refusing::default();
    let keychain = Keychain::with_os(Box::new(locked.clone()), &dir);

    keychain.reset(ResetPlan::InPlace).unwrap();
    assert_eq!(locked.asked(), 1);
    assert_cleared(&dir);
    assert_reset(&dir, &keychain, KeyStorage::File);
    let parked = tokio::time::timeout(Duration::from_millis(50), keychain.refusals().notified());
    assert!(parked.await.is_err());
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn the_windows_probe_keeps_a_store_that_reads_back_what_it_saved() {
    let dir = scratch("probe");
    let vault = SharedVault::default();
    chat_on_disk(&dir, &vault);
    let keychain = Keychain::with_os(Box::new(vault.clone()), &dir);

    keychain.reset(ResetPlan::Probe).unwrap();
    assert_cleared(&dir);
    assert_reset(&dir, &keychain, KeyStorage::Os);
    for name in KeyName::ALL {
        assert!(!vault.holds(name), "{name:?}");
    }
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn the_windows_probe_moves_to_the_file_when_the_store_misbehaves() {
    let garbled = scratch("probe-garbled");
    let vault = SharedVault::default();
    chat_on_disk(&garbled, &vault);
    let keychain = Keychain::with_os(Box::new(Garbling(vault.clone())), &garbled);
    keychain.reset(ResetPlan::Probe).unwrap();
    assert_reset(&garbled, &keychain, KeyStorage::File);
    assert!(!vault.holds(KeyName::Database));
    fs::remove_dir_all(garbled).unwrap();

    let broken = scratch("probe-broken");
    chat_on_disk(&broken, &SharedVault::default());
    let keychain = Keychain::with_os(Box::new(Broken), &broken);
    keychain.reset(ResetPlan::Probe).unwrap();
    assert_cleared(&broken);
    assert_reset(&broken, &keychain, KeyStorage::File);
    fs::remove_dir_all(broken).unwrap();
}

#[test]
fn a_reset_is_remembered_for_a_week() {
    let dir = scratch("lately");
    let keychain = Keychain::with_os(Box::new(SharedVault::default()), &dir);
    assert!(!keychain.reset_lately());
    keychain.reset(ResetPlan::InPlace).unwrap();
    assert!(keychain.reset_lately());
    let old = now_ms() - LATELY_MS - 1;
    fs::write(dir.join("keys-reset"), old.to_string()).unwrap();
    assert!(!keychain.reset_lately());
    fs::write(dir.join("keys-reset"), "garbage").unwrap();
    assert!(!keychain.reset_lately());
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_week_counts_from_the_last_reset_and_a_clock_that_went_back_counts_as_recent() {
    assert!(lately(1_000, 1_000));
    assert!(lately(1_000, 1_000 + LATELY_MS - 1));
    assert!(!lately(1_000, 1_000 + LATELY_MS));
    assert!(lately(5_000, 1_000));
}

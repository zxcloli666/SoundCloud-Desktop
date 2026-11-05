use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::Duration;

use sc_chat::{ChatError, ChatResult, KeyName, KeyStorage, KeyStore, Zeroizing};

use super::{FileVault, Keychain, Vault, should_fall_back};

struct Broken;

impl Vault for Broken {
    fn load(&self, _name: KeyName) -> ChatResult<Option<Zeroizing<Vec<u8>>>> {
        Err(ChatError::Keychain)
    }

    fn save(&self, _name: KeyName, _secret: &[u8]) -> ChatResult<()> {
        Err(ChatError::Keychain)
    }

    fn delete(&self, _name: KeyName) -> ChatResult<()> {
        Err(ChatError::Keychain)
    }
}

#[derive(Clone, Default)]
struct Refusing {
    asked: Arc<AtomicU32>,
    allow_after: Option<u32>,
}

impl Refusing {
    fn answer<T>(&self, granted: T) -> ChatResult<T> {
        let asked = self.asked.fetch_add(1, Ordering::SeqCst) + 1;
        match self.allow_after {
            Some(after) if asked > after => Ok(granted),
            _ => Err(ChatError::KeychainDenied),
        }
    }

    fn asked(&self) -> u32 {
        self.asked.load(Ordering::SeqCst)
    }
}

impl Vault for Refusing {
    fn load(&self, _name: KeyName) -> ChatResult<Option<Zeroizing<Vec<u8>>>> {
        self.answer(None)
    }

    fn save(&self, _name: KeyName, _secret: &[u8]) -> ChatResult<()> {
        self.answer(())
    }

    fn delete(&self, _name: KeyName) -> ChatResult<()> {
        self.answer(())
    }
}

fn scratch(name: &str) -> PathBuf {
    let dir =
        std::env::temp_dir().join(format!("sc-chat-keychain-{name}-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn file_vault_round_trips_and_deletes() {
    let dir = scratch("round-trip");
    let vault = FileVault::new(&dir);
    assert!(vault.load(KeyName::Database).unwrap().is_none());
    vault.save(KeyName::Database, &[1, 2, 3]).unwrap();
    vault.save(KeyName::Database, &[4, 5]).unwrap();
    assert_eq!(
        vault.load(KeyName::Database).unwrap().unwrap().as_slice(),
        &[4, 5]
    );
    assert!(vault.load(KeyName::DeviceAuth).unwrap().is_none());
    vault.delete(KeyName::Database).unwrap();
    vault.delete(KeyName::Database).unwrap();
    assert!(vault.load(KeyName::Database).unwrap().is_none());
    std::fs::remove_dir_all(dir).unwrap();
}

#[cfg(unix)]
#[test]
fn file_vault_keeps_secrets_private() {
    use std::os::unix::fs::PermissionsExt;

    let dir = scratch("private");
    let vault = FileVault::new(&dir);
    vault.save(KeyName::DeviceBox, &[9; 32]).unwrap();
    let keys = dir.join("keys");
    let dir_mode = std::fs::metadata(&keys).unwrap().permissions().mode() & 0o777;
    let file_mode = std::fs::metadata(keys.join("device-box"))
        .unwrap()
        .permissions()
        .mode()
        & 0o777;
    assert_eq!(dir_mode, 0o700);
    assert_eq!(file_mode, 0o600);
    assert!(!keys.join("device-box.new").exists());
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_keychain_with_a_key_file_stays_on_the_file() {
    let dir = scratch("sticky");
    FileVault::new(&dir).create().unwrap();
    let keychain = Keychain::new("sc-chat-test", &dir);
    assert_eq!(keychain.storage(), KeyStorage::File);
    keychain.save(KeyName::DeviceId, b"device").unwrap();
    let reopened = Keychain::new("sc-chat-test", &dir);
    assert_eq!(reopened.storage(), KeyStorage::File);
    assert_eq!(
        reopened
            .load(KeyName::DeviceId)
            .unwrap()
            .unwrap()
            .as_slice(),
        b"device"
    );
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn wiping_a_file_keychain_removes_every_key_and_stays_on_the_file() {
    let dir = scratch("wipe");
    let keychain = Keychain::new("sc-chat-test", &dir);
    keychain.fall_back().unwrap();
    for name in KeyName::ALL {
        keychain.save(name, &[7; 32]).unwrap();
    }
    keychain.wipe().unwrap();
    assert_eq!(keychain.storage(), KeyStorage::File);
    for name in KeyName::ALL {
        assert!(keychain.load(name).unwrap().is_none());
    }
    assert_eq!(std::fs::read_dir(dir.join("keys")).unwrap().count(), 0);
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_broken_os_keychain_with_no_local_chat_moves_to_the_file_at_once() {
    let dir = scratch("broken-fresh");
    let keychain = Keychain::with_os(Box::new(Broken), &dir);
    assert_eq!(keychain.storage(), KeyStorage::Os);
    assert!(keychain.load(KeyName::DeviceId).unwrap().is_none());
    assert_eq!(keychain.storage(), KeyStorage::File);
    keychain.save(KeyName::DeviceId, b"device").unwrap();
    assert_eq!(
        keychain
            .load(KeyName::DeviceId)
            .unwrap()
            .unwrap()
            .as_slice(),
        b"device"
    );
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_broken_os_keychain_with_a_local_chat_keeps_failing() {
    let dir = scratch("broken-old");
    std::fs::write(dir.join("chat.db"), b"").unwrap();
    let keychain = Keychain::with_os(Box::new(Broken), &dir);
    assert_eq!(
        keychain.load(KeyName::Database).err(),
        Some(ChatError::Keychain)
    );
    assert_eq!(keychain.storage(), KeyStorage::Os);
    assert!(!dir.join("keys").exists());
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_fresh_install_falls_back_at_once_and_an_old_one_waits() {
    assert!(should_fall_back(KeyStorage::Os, false, 1));
    assert!(!should_fall_back(KeyStorage::Os, true, 1));
    assert!(!should_fall_back(KeyStorage::Os, true, 4));
    assert!(should_fall_back(KeyStorage::Os, true, 5));
    assert!(!should_fall_back(KeyStorage::File, false, 9));
}

#[test]
fn a_refused_keychain_is_asked_once_and_never_again_without_a_retry() {
    let dir = scratch("refused");
    std::fs::write(dir.join("chat.db"), b"").unwrap();
    let vault = Refusing::default();
    let keychain = Keychain::with_os(Box::new(vault.clone()), &dir);
    assert_eq!(
        keychain.load(KeyName::Database).err(),
        Some(ChatError::KeychainDenied)
    );
    assert!(keychain.denied());
    for name in KeyName::ALL {
        assert_eq!(keychain.load(name).err(), Some(ChatError::KeychainDenied));
        assert_eq!(
            keychain.save(name, b"x").err(),
            Some(ChatError::KeychainDenied)
        );
    }
    assert_eq!(keychain.wipe().err(), Some(ChatError::KeychainDenied));
    assert_eq!(vault.asked(), 1);
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_refusal_on_a_fresh_install_does_not_move_keys_to_a_file() {
    let dir = scratch("refused-fresh");
    let vault = Refusing::default();
    let keychain = Keychain::with_os(Box::new(vault.clone()), &dir);
    assert_eq!(
        keychain.load(KeyName::DeviceId).err(),
        Some(ChatError::KeychainDenied)
    );
    assert_eq!(keychain.storage(), KeyStorage::Os);
    assert!(!dir.join("keys").exists());
    assert_eq!(vault.asked(), 1);
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_retry_asks_the_keychain_exactly_once_more() {
    let dir = scratch("refused-retry");
    std::fs::write(dir.join("chat.db"), b"").unwrap();
    let vault = Refusing {
        allow_after: Some(1),
        ..Refusing::default()
    };
    let keychain = Keychain::with_os(Box::new(vault.clone()), &dir);
    assert_eq!(
        keychain.load(KeyName::Database).err(),
        Some(ChatError::KeychainDenied)
    );
    assert_eq!(
        keychain.load(KeyName::Database).err(),
        Some(ChatError::KeychainDenied)
    );
    assert_eq!(vault.asked(), 1);
    keychain.allow();
    assert!(!keychain.denied());
    assert!(keychain.load(KeyName::Database).unwrap().is_none());
    assert_eq!(vault.asked(), 2);
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_second_refusal_after_a_retry_latches_again() {
    let dir = scratch("refused-twice");
    std::fs::write(dir.join("chat.db"), b"").unwrap();
    let vault = Refusing::default();
    let keychain = Keychain::with_os(Box::new(vault.clone()), &dir);
    let _ = keychain.load(KeyName::Database);
    keychain.allow();
    assert_eq!(
        keychain.load(KeyName::Database).err(),
        Some(ChatError::KeychainDenied)
    );
    assert_eq!(
        keychain.load(KeyName::DeviceAuth).err(),
        Some(ChatError::KeychainDenied)
    );
    assert_eq!(vault.asked(), 2);
    std::fs::remove_dir_all(dir).unwrap();
}

#[tokio::test]
async fn a_refusal_parks_the_chat_once() {
    let dir = scratch("parks");
    let keychain = Keychain::with_os(Box::new(Refusing::default()), &dir);
    assert_eq!(
        keychain.load(KeyName::Database).err(),
        Some(ChatError::KeychainDenied)
    );
    assert_eq!(
        keychain.load(KeyName::DeviceId).err(),
        Some(ChatError::KeychainDenied)
    );
    let parked = tokio::time::timeout(Duration::from_millis(200), keychain.refusals().notified());
    assert!(parked.await.is_ok());
    let again = tokio::time::timeout(Duration::from_millis(50), keychain.refusals().notified());
    assert!(again.await.is_err());
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn keys_left_by_a_refused_wipe_go_after_the_retry() {
    let dir = scratch("stale");
    let stale = dir.join("keys-stale");
    let vault = Refusing {
        allow_after: Some(1),
        ..Refusing::default()
    };
    let keychain = Keychain::with_os(Box::new(vault.clone()), &dir);
    keychain.sweep().unwrap();
    assert_eq!(vault.asked(), 0);
    assert_eq!(keychain.wipe().err(), Some(ChatError::KeychainDenied));
    assert!(stale.exists());
    assert_eq!(keychain.sweep().err(), Some(ChatError::KeychainDenied));
    assert_eq!(vault.asked(), 1);
    keychain.allow();
    keychain.sweep().unwrap();
    let every_key = 1 + KeyName::ALL.len() as u32;
    assert_eq!(vault.asked(), every_key);
    assert!(!stale.exists());
    keychain.sweep().unwrap();
    assert_eq!(vault.asked(), every_key);
    std::fs::remove_dir_all(dir).unwrap();
}

use std::path::PathBuf;

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

use std::path::PathBuf;

use sc_chat::crypto::DeviceKeys;
use sc_chat::store::Store;
use sc_chat::{ChatResult, KeyName, KeyStorage, KeyStore, Zeroizing};
use uuid::Uuid;

use super::super::cred_move::{
    Credentials, ENTERPRISE, LOCAL_MACHINE, Localized, Stored, localize,
};
use super::super::{Keychain, ResetPlan, Vault, database_path};
use super::{CredVault, WinCred};

struct Cleanup(Vec<String>);

impl Drop for Cleanup {
    fn drop(&mut self) {
        for target in &self.0 {
            let _ = WinCred.delete(target);
        }
    }
}

fn vault() -> (CredVault, Cleanup) {
    let vault = CredVault::new(&format!("sc-chat-test-{}", Uuid::new_v4().simple()));
    let targets = KeyName::ALL
        .iter()
        .map(|name| vault.target(*name))
        .collect();
    (vault, Cleanup(targets))
}

fn persist_of(target: &str) -> u32 {
    WinCred.read(target).unwrap().unwrap().persist
}

#[test]
fn a_saved_key_reads_back_and_stays_on_this_machine() {
    let (vault, _cleanup) = vault();
    let name = KeyName::DeviceId;
    assert!(vault.load(name).unwrap().is_none());
    vault.save(name, b"device-one").unwrap();
    assert_eq!(vault.load(name).unwrap().unwrap().as_slice(), b"device-one");
    assert_eq!(persist_of(&vault.target(name)), LOCAL_MACHINE);
    vault.save(name, b"device-two").unwrap();
    assert_eq!(vault.load(name).unwrap().unwrap().as_slice(), b"device-two");
    vault.delete(name).unwrap();
    assert!(vault.load(name).unwrap().is_none());
    vault.delete(name).unwrap();
}

#[test]
fn a_roaming_key_from_an_older_build_moves_to_this_machine_in_place() {
    let (vault, _cleanup) = vault();
    let name = KeyName::Database;
    let target = vault.target(name);
    let secret: Vec<u8> = (0..=255).collect();
    WinCred
        .write(&target, name.as_str(), &secret, ENTERPRISE)
        .unwrap();
    assert_eq!(persist_of(&target), ENTERPRISE);
    assert_eq!(
        vault.load(name).unwrap().unwrap().as_slice(),
        secret.as_slice()
    );
    assert_eq!(persist_of(&target), LOCAL_MACHINE);
    assert_eq!(
        vault.load(name).unwrap().unwrap().as_slice(),
        secret.as_slice()
    );
}

#[test]
fn a_key_saved_by_the_keyring_build_loads_and_moves_to_this_machine() {
    let (vault, _cleanup) = vault();
    let name = KeyName::DeviceId;
    let secret: Vec<u8> = (0..32).collect();
    let entry = keyring::Entry::new(&vault.service, name.as_str()).unwrap();
    entry.set_secret(&secret).unwrap();
    assert_eq!(persist_of(&vault.target(name)), ENTERPRISE);
    assert_eq!(
        vault.load(name).unwrap().unwrap().as_slice(),
        secret.as_slice()
    );
    assert_eq!(persist_of(&vault.target(name)), LOCAL_MACHINE);
    assert_eq!(entry.get_secret().unwrap(), secret);
}

struct Tampering;

impl Credentials for Tampering {
    fn read(&self, target: &str) -> Result<Option<Stored>, u32> {
        let mut found = WinCred.read(target)?;
        if let Some(found) = found.as_mut()
            && found.persist == LOCAL_MACHINE
        {
            found.secret.push(0);
        }
        Ok(found)
    }

    fn write(&self, target: &str, user: &str, secret: &[u8], persist: u32) -> Result<(), u32> {
        WinCred.write(target, user, secret, persist)
    }
}

#[test]
fn a_move_that_does_not_read_back_the_same_puts_the_roaming_key_back() {
    let (vault, _cleanup) = vault();
    let name = KeyName::Database;
    let target = vault.target(name);
    WinCred
        .write(&target, name.as_str(), b"database key", ENTERPRISE)
        .unwrap();
    let found = WinCred.read(&target).unwrap().unwrap();
    assert_eq!(
        localize(&Tampering, &target, name.as_str(), &found),
        Localized::Restored
    );
    let back = WinCred.read(&target).unwrap().unwrap();
    assert_eq!(back.persist, ENTERPRISE);
    assert_eq!(back.secret.as_slice(), b"database key");
}

struct Garbled(CredVault);

impl Vault for Garbled {
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

fn chat_dir() -> PathBuf {
    let dir = std::env::temp_dir().join(format!("sc-chat-wincred-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn none_left(vault: &CredVault) -> bool {
    KeyName::ALL
        .iter()
        .all(|name| WinCred.read(&vault.target(*name)).unwrap().is_none())
}

#[test]
fn an_in_place_reset_deletes_every_credential_and_new_keys_stay_on_this_machine() {
    let (vault, _cleanup) = vault();
    let dir = chat_dir();
    let keychain = Keychain::with_os(Box::new(CredVault::new(&vault.service)), &dir);
    let (old, _) = DeviceKeys::load_or_create(&keychain).unwrap();
    drop(Store::open_keyed(&database_path(&dir), &keychain).unwrap());
    for name in KeyName::ALL {
        assert_eq!(persist_of(&vault.target(name)), LOCAL_MACHINE, "{name:?}");
    }

    keychain.reset(ResetPlan::InPlace).unwrap();
    assert_eq!(keychain.storage(), KeyStorage::Os);
    assert!(none_left(&vault));
    assert!(!dir.join("keys").exists());
    assert!(!database_path(&dir).exists());

    let (fresh, _) = DeviceKeys::load_or_create(&keychain).unwrap();
    assert_ne!(fresh, old);
    assert_eq!(persist_of(&vault.target(KeyName::DeviceId)), LOCAL_MACHINE);
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_probe_on_a_working_credential_manager_leaves_no_test_value() {
    let (vault, _cleanup) = vault();
    let dir = chat_dir();
    let keychain = Keychain::with_os(Box::new(CredVault::new(&vault.service)), &dir);
    DeviceKeys::load_or_create(&keychain).unwrap();

    keychain.reset(ResetPlan::Probe).unwrap();
    assert_eq!(keychain.storage(), KeyStorage::Os);
    assert!(none_left(&vault));
    assert!(!dir.join("keys").exists());
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_probe_that_reads_back_something_else_leaves_the_file_vault() {
    let (vault, _cleanup) = vault();
    let dir = chat_dir();
    let keychain = Keychain::with_os(Box::new(Garbled(CredVault::new(&vault.service))), &dir);

    keychain.reset(ResetPlan::Probe).unwrap();
    assert_eq!(keychain.storage(), KeyStorage::File);
    assert!(dir.join("keys").is_dir());
    assert!(none_left(&vault));
    DeviceKeys::load_or_create(&keychain).unwrap();
    assert!(none_left(&vault));
    let restarted = Keychain::with_os(Box::new(CredVault::new(&vault.service)), &dir);
    assert_eq!(restarted.storage(), KeyStorage::File);
    std::fs::remove_dir_all(dir).unwrap();
}

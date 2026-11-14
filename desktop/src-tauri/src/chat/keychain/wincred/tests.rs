use std::path::PathBuf;
use std::ptr;
use std::thread;
use std::time::Duration;

use sc_chat::crypto::DeviceKeys;
use sc_chat::store::Store;
use sc_chat::{ChatResult, KeyName, KeyStorage, KeyStore, Zeroizing};
use uuid::Uuid;
use windows_sys::Win32::Security::Credentials::{CREDENTIALW, CredEnumerateW, CredFree};

use super::super::cred_move::{self, Credentials, ENTERPRISE, LOCAL_MACHINE, spare};
use super::super::{Keychain, ResetPlan, Vault, database_path};
use super::{CredVault, WinCred, held, wide};

struct Cleanup(Vec<String>);

impl Drop for Cleanup {
    fn drop(&mut self) {
        for target in &self.0 {
            let _ = direct(|| cred_move::delete(&WinCred, target));
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

fn direct<T>(op: impl FnOnce() -> T) -> T {
    let _held = held();
    op()
}

fn persist_of(target: &str) -> u32 {
    direct(|| WinCred.read(target)).unwrap().unwrap().persist
}

fn copies(target: &str) -> Vec<u32> {
    let filter = wide(&format!("{target}*"));
    let mut count = 0;
    let mut list: *mut *mut CREDENTIALW = ptr::null_mut();
    let _held = held();
    if unsafe { CredEnumerateW(filter.as_ptr(), 0, &mut count, &mut list) } == 0 {
        return Vec::new();
    }
    let persists = (0..count as usize)
        .filter_map(|index| {
            let credential = unsafe { &**list.add(index) };
            let name = unsafe { text(credential.TargetName) };
            (name == target).then_some(credential.Persist)
        })
        .collect();
    unsafe { CredFree(list as *const core::ffi::c_void) };
    persists
}

unsafe fn text(name: *const u16) -> String {
    let len = (0..)
        .take_while(|&at| unsafe { *name.add(at) } != 0)
        .count();
    String::from_utf16_lossy(unsafe { std::slice::from_raw_parts(name, len) })
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
fn a_roaming_key_from_an_older_build_moves_to_this_machine() {
    let (vault, _cleanup) = vault();
    let name = KeyName::Database;
    let target = vault.target(name);
    let secret: Vec<u8> = (0..=255).collect();
    direct(|| WinCred.write(&target, name.as_str(), &secret, ENTERPRISE)).unwrap();
    assert_eq!(persist_of(&target), ENTERPRISE);
    assert_eq!(
        vault.load(name).unwrap().unwrap().as_slice(),
        secret.as_slice()
    );
    assert_eq!(copies(&target), [LOCAL_MACHINE]);
    assert!(copies(&spare(&target)).is_empty());
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
    direct(|| entry.set_secret(&secret)).unwrap();
    assert_eq!(persist_of(&vault.target(name)), ENTERPRISE);
    assert_eq!(
        vault.load(name).unwrap().unwrap().as_slice(),
        secret.as_slice()
    );
    assert_eq!(copies(&vault.target(name)), [LOCAL_MACHINE]);
    assert_eq!(direct(|| entry.get_secret()).unwrap(), secret);
}

#[test]
fn a_moved_key_leaves_no_roaming_copy_behind() {
    let (other, _other_cleanup) = vault();
    let (vault, _cleanup) = vault();
    let name = KeyName::Database;
    let target = vault.target(name);
    let other_target = other.target(name);
    for round in 0..20u8 {
        let secret = [round; 16];
        direct(|| WinCred.write(&target, name.as_str(), &secret, ENTERPRISE)).unwrap();
        assert_eq!(vault.load(name).unwrap().unwrap().as_slice(), secret);
        for tick in 0..3u8 {
            direct(|| WinCred.write(&other_target, name.as_str(), &[tick; 4], ENTERPRISE)).unwrap();
            thread::sleep(Duration::from_millis(30));
        }
        assert_eq!(copies(&target), [LOCAL_MACHINE], "round {round}");
        assert_eq!(vault.load(name).unwrap().unwrap().as_slice(), secret);
        vault.delete(name).unwrap();
        assert!(copies(&target).is_empty(), "round {round}");
    }
}

#[test]
fn vaults_used_from_several_threads_read_back_every_save_and_move() {
    let workers: Vec<_> = (0..4)
        .map(|worker| thread::spawn(move || churn(worker)))
        .collect();
    for worker in workers {
        worker.join().unwrap();
    }
}

fn churn(worker: u8) {
    let (vault, _cleanup) = vault();
    let name = KeyName::Database;
    let target = vault.target(name);
    for round in 0..25u8 {
        let roaming = [worker, round, 1];
        let local = [worker, round, 2];
        direct(|| WinCred.write(&target, name.as_str(), &roaming, ENTERPRISE)).unwrap();
        assert_eq!(vault.load(name).unwrap().unwrap().as_slice(), roaming);
        assert_eq!(persist_of(&target), LOCAL_MACHINE);
        vault.save(name, &local).unwrap();
        assert_eq!(vault.load(name).unwrap().unwrap().as_slice(), local);
        vault.delete(name).unwrap();
        assert!(vault.load(name).unwrap().is_none());
    }
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
    KeyName::ALL.iter().all(|name| {
        let target = vault.target(*name);
        copies(&target).is_empty() && copies(&spare(&target)).is_empty()
    })
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

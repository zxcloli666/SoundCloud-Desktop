use sc_chat::KeyName;
use uuid::Uuid;

use super::super::Vault;
use super::super::cred_move::{
    Credentials, ENTERPRISE, LOCAL_MACHINE, Localized, Stored, localize,
};
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

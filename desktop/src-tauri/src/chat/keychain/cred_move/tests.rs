use std::cell::{Cell, RefCell};
use std::collections::HashMap;

use sc_chat::Zeroizing;

use super::{Credentials, ENTERPRISE, LOCAL_MACHINE, Localized, Stored, load};

const TARGET: &str = "chat-device-key.com.soundcloud.desktop.chat";
const USER: &str = "chat-device-key";
const SECRET: &[u8] = b"device key bytes";
const DISK_FULL: u32 = 112;

#[derive(Default)]
struct Fake {
    entries: RefCell<HashMap<String, (Vec<u8>, u32)>>,
    failing_writes: Cell<usize>,
    tamper: Cell<bool>,
    writes: Cell<usize>,
}

impl Fake {
    fn with(persist: u32) -> Self {
        let fake = Self::default();
        fake.entries
            .borrow_mut()
            .insert(TARGET.into(), (SECRET.to_vec(), persist));
        fake
    }

    fn entry(&self) -> (Vec<u8>, u32) {
        self.entries.borrow()[TARGET].clone()
    }
}

impl Credentials for Fake {
    fn read(&self, target: &str) -> Result<Option<Stored>, u32> {
        Ok(self
            .entries
            .borrow()
            .get(target)
            .map(|(secret, persist)| Stored {
                secret: Zeroizing::new(secret.clone()),
                persist: *persist,
            }))
    }

    fn write(&self, target: &str, user: &str, secret: &[u8], persist: u32) -> Result<(), u32> {
        assert_eq!(user, USER);
        self.writes.set(self.writes.get() + 1);
        if self.failing_writes.get() > 0 {
            self.failing_writes.set(self.failing_writes.get() - 1);
            return Err(DISK_FULL);
        }
        let mut stored = secret.to_vec();
        if self.tamper.replace(false) {
            stored.push(0);
        }
        self.entries
            .borrow_mut()
            .insert(target.into(), (stored, persist));
        Ok(())
    }
}

fn loaded(fake: &Fake) -> (Vec<u8>, Option<Localized>) {
    let (found, localized) = load(fake, TARGET, USER).unwrap().unwrap();
    (found.secret.to_vec(), localized)
}

#[test]
fn a_roaming_entry_moves_to_this_machine_in_place() {
    let fake = Fake::with(ENTERPRISE);
    assert_eq!(loaded(&fake), (SECRET.to_vec(), Some(Localized::Moved)));
    assert_eq!(fake.entry(), (SECRET.to_vec(), LOCAL_MACHINE));
    assert_eq!(fake.entries.borrow().len(), 1);
}

#[test]
fn an_entry_already_on_this_machine_is_left_as_it_is() {
    let fake = Fake::with(LOCAL_MACHINE);
    assert_eq!(loaded(&fake), (SECRET.to_vec(), None));
    assert_eq!(fake.writes.get(), 0);
}

#[test]
fn only_a_roaming_entry_is_moved() {
    const SESSION: u32 = 1;
    let fake = Fake::with(SESSION);
    assert_eq!(loaded(&fake), (SECRET.to_vec(), None));
    assert_eq!(fake.entry(), (SECRET.to_vec(), SESSION));
    assert_eq!(fake.writes.get(), 0);
}

#[test]
fn a_missing_entry_reads_as_none_and_writes_nothing() {
    let fake = Fake::default();
    assert!(load(&fake, TARGET, USER).unwrap().is_none());
    assert_eq!(fake.writes.get(), 0);
}

#[test]
fn a_failed_write_changes_nothing_and_the_key_still_loads() {
    let fake = Fake::with(ENTERPRISE);
    fake.failing_writes.set(1);
    assert_eq!(
        loaded(&fake),
        (SECRET.to_vec(), Some(Localized::Unwritten(DISK_FULL)))
    );
    assert_eq!(fake.entry(), (SECRET.to_vec(), ENTERPRISE));
}

#[test]
fn a_read_back_that_differs_puts_the_old_entry_back() {
    let fake = Fake::with(ENTERPRISE);
    fake.tamper.set(true);
    assert_eq!(loaded(&fake), (SECRET.to_vec(), Some(Localized::Restored)));
    assert_eq!(fake.entry(), (SECRET.to_vec(), ENTERPRISE));
}

#[test]
fn a_rerun_after_a_failure_moves_the_entry() {
    let fake = Fake::with(ENTERPRISE);
    fake.failing_writes.set(1);
    loaded(&fake);
    assert_eq!(fake.entry().1, ENTERPRISE);
    assert_eq!(loaded(&fake), (SECRET.to_vec(), Some(Localized::Moved)));
    assert_eq!(fake.entry(), (SECRET.to_vec(), LOCAL_MACHINE));
}

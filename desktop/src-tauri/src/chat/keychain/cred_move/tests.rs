use std::cell::{Cell, RefCell};
use std::collections::{BTreeMap, VecDeque};

use sc_chat::Zeroizing;

use super::{
    ATTEMPTS, Credentials, ENTERPRISE, Failure, LOCAL_MACHINE, Localized, Stored, delete, load,
    save, spare,
};

const TARGET: &str = "chat-device-key.com.soundcloud.desktop.chat";
const USER: &str = "chat-device-key";
const SECRET: &[u8] = b"device key bytes";
const NEWER: &[u8] = b"newer key bytes";
const DISK_FULL: u32 = 112;
const GONE: u32 = 0xdead;

#[derive(Clone, Copy)]
enum Fault {
    Pass,
    Fail,
    Drop,
    Tamper,
}

#[derive(Default)]
struct Fake {
    entries: RefCell<BTreeMap<String, (Vec<u8>, u32)>>,
    faults: RefCell<VecDeque<Fault>>,
    budget: Cell<Option<usize>>,
    writes: Cell<usize>,
    deletes: Cell<usize>,
}

impl Fake {
    fn with(secret: &[u8], persist: u32) -> Self {
        let fake = Self::default();
        fake.entries
            .borrow_mut()
            .insert(TARGET.into(), (secret.to_vec(), persist));
        fake
    }

    fn failing(self, faults: &[Fault]) -> Self {
        self.faults.borrow_mut().extend(faults);
        self
    }

    fn only(&self, secret: &[u8]) -> bool {
        let entries = self.entries.borrow();
        entries.len() == 1 && entries.get(TARGET) == Some(&(secret.to_vec(), LOCAL_MACHINE))
    }

    fn fault(&self) -> Result<Fault, u32> {
        match self.budget.get() {
            Some(0) => return Err(GONE),
            Some(left) => self.budget.set(Some(left - 1)),
            None => {}
        }
        Ok(self.faults.borrow_mut().pop_front().unwrap_or(Fault::Pass))
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
        assert_eq!(persist, LOCAL_MACHINE);
        let mut stored = secret.to_vec();
        match self.fault()? {
            Fault::Fail => return Err(DISK_FULL),
            Fault::Drop => return Ok(()),
            Fault::Tamper => stored.push(0),
            Fault::Pass => {}
        }
        self.writes.set(self.writes.get() + 1);
        if let Some((_, old)) = self.entries.borrow().get(target) {
            assert_eq!(*old, LOCAL_MACHINE, "persist changed in place");
        }
        self.entries
            .borrow_mut()
            .insert(target.into(), (stored, persist));
        Ok(())
    }

    fn delete(&self, target: &str) -> Result<(), u32> {
        match self.fault()? {
            Fault::Fail => return Err(DISK_FULL),
            Fault::Drop => return Ok(()),
            Fault::Tamper | Fault::Pass => {}
        }
        self.deletes.set(self.deletes.get() + 1);
        self.entries.borrow_mut().remove(target);
        Ok(())
    }
}

fn loaded(fake: &Fake) -> (Vec<u8>, Option<Localized>) {
    let (found, localized) = load(fake, TARGET, USER).unwrap().unwrap();
    (found.secret.to_vec(), localized)
}

#[test]
fn a_roaming_entry_moves_to_this_machine_without_changing_it_in_place() {
    let fake = Fake::with(SECRET, ENTERPRISE);
    assert_eq!(loaded(&fake), (SECRET.to_vec(), Some(Localized::Moved)));
    assert!(fake.only(SECRET));
    assert_eq!((fake.writes.get(), fake.deletes.get()), (2, 2));
}

#[test]
fn an_entry_already_on_this_machine_is_left_as_it_is() {
    let fake = Fake::with(SECRET, LOCAL_MACHINE);
    assert_eq!(loaded(&fake), (SECRET.to_vec(), None));
    assert_eq!((fake.writes.get(), fake.deletes.get()), (0, 0));
}

#[test]
fn only_a_roaming_entry_is_moved() {
    const SESSION: u32 = 1;
    let fake = Fake::with(SECRET, SESSION);
    assert_eq!(loaded(&fake), (SECRET.to_vec(), None));
    assert_eq!((fake.writes.get(), fake.deletes.get()), (0, 0));
}

#[test]
fn a_missing_entry_reads_as_none_and_writes_nothing() {
    let fake = Fake::default();
    assert!(load(&fake, TARGET, USER).unwrap().is_none());
    assert_eq!((fake.writes.get(), fake.deletes.get()), (0, 0));
}

#[test]
fn a_spare_that_cannot_be_written_changes_nothing() {
    let fake = Fake::with(SECRET, ENTERPRISE).failing(&[Fault::Fail]);
    assert_eq!(
        loaded(&fake),
        (
            SECRET.to_vec(),
            Some(Localized::Unwritten(Failure::Os(DISK_FULL)))
        )
    );
    assert_eq!(
        fake.entries.borrow().get(TARGET),
        Some(&(SECRET.to_vec(), ENTERPRISE))
    );
    assert_eq!(fake.entries.borrow().len(), 1);
}

#[test]
fn a_write_or_delete_the_store_drops_or_garbles_is_sent_again() {
    let fake = Fake::with(SECRET, ENTERPRISE).failing(&[Fault::Tamper, Fault::Pass, Fault::Drop]);
    assert_eq!(loaded(&fake), (SECRET.to_vec(), Some(Localized::Moved)));
    assert!(fake.only(SECRET));
}

#[test]
fn a_roaming_entry_that_will_not_go_keeps_the_key_and_moves_on_the_next_load() {
    let fake = Fake::with(SECRET, ENTERPRISE).failing(&[
        Fault::Pass,
        Fault::Drop,
        Fault::Drop,
        Fault::Drop,
    ]);
    assert_eq!(
        loaded(&fake),
        (
            SECRET.to_vec(),
            Some(Localized::Undeleted(Failure::Unconfirmed))
        )
    );
    assert_eq!(
        fake.entries.borrow().get(TARGET),
        Some(&(SECRET.to_vec(), ENTERPRISE))
    );
    assert_eq!(loaded(&fake), (SECRET.to_vec(), Some(Localized::Moved)));
    assert!(fake.only(SECRET));
}

#[test]
fn a_move_cut_short_after_any_step_loads_the_same_key_next_time() {
    for steps in 0..8 {
        let fake = Fake::with(SECRET, ENTERPRISE);
        fake.budget.set(Some(steps));
        if let Ok(Some((found, _))) = load(&fake, TARGET, USER) {
            assert_eq!(found.secret.as_slice(), SECRET, "cut after {steps}");
        }
        fake.budget.set(None);
        assert_eq!(loaded(&fake).0, SECRET, "cut after {steps}");
        assert!(fake.only(SECRET), "cut after {steps}");
    }
}

#[test]
fn a_save_over_a_roaming_entry_cut_short_leaves_one_whole_key() {
    for steps in 0..8 {
        let fake = Fake::with(SECRET, ENTERPRISE);
        fake.budget.set(Some(steps));
        let saved = save(&fake, TARGET, USER, NEWER);
        fake.budget.set(None);
        let (key, _) = loaded(&fake);
        if saved.is_ok() {
            assert_eq!(key, NEWER, "cut after {steps}");
        }
        assert!(key == SECRET || key == NEWER, "cut after {steps}");
        assert!(fake.only(&key), "cut after {steps}");
    }
}

#[test]
fn a_save_on_this_machine_overwrites_in_place() {
    let fake = Fake::with(SECRET, LOCAL_MACHINE);
    save(&fake, TARGET, USER, NEWER).unwrap();
    assert!(fake.only(NEWER));
    assert_eq!((fake.writes.get(), fake.deletes.get()), (1, 0));
}

#[test]
fn a_save_that_never_reads_back_fails() {
    let fake = Fake::default().failing(&[Fault::Tamper; ATTEMPTS]);
    assert_eq!(save(&fake, TARGET, USER, SECRET), Err(Failure::Unconfirmed));
}

#[test]
fn a_delete_takes_the_key_and_a_left_spare() {
    let fake = Fake::with(SECRET, LOCAL_MACHINE);
    fake.entries
        .borrow_mut()
        .insert(spare(TARGET), (SECRET.to_vec(), LOCAL_MACHINE));
    delete(&fake, TARGET).unwrap();
    assert!(fake.entries.borrow().is_empty());
    assert!(load(&fake, TARGET, USER).unwrap().is_none());
}

#[test]
fn a_delete_that_never_takes_fails() {
    let fake = Fake::with(SECRET, LOCAL_MACHINE).failing(&[Fault::Drop; ATTEMPTS + 1]);
    assert_eq!(delete(&fake, TARGET), Err(Failure::Unconfirmed));
    assert_eq!(loaded(&fake).0, SECRET);
}

#[test]
fn a_spare_left_next_to_a_local_key_is_cleared() {
    let fake = Fake::with(SECRET, LOCAL_MACHINE);
    fake.entries
        .borrow_mut()
        .insert(spare(TARGET), (SECRET.to_vec(), LOCAL_MACHINE));
    assert_eq!(loaded(&fake), (SECRET.to_vec(), None));
    assert!(fake.only(SECRET));
}

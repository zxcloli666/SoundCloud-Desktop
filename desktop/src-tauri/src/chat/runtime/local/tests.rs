use std::fs;
use std::path::{Path, PathBuf};

use sc_chat::ConversationKind;
use sc_chat::store::Store;
use uuid::Uuid;

use super::{clear_local, database_path, remove_database};
use crate::chat::keychain::Keychain;
use crate::chat::keychain::testing::SharedVault;
use crate::chat::notify::tests::fixtures::chat;

fn scratch() -> PathBuf {
    let dir = std::env::temp_dir().join(format!("sc-chat-local-{}", Uuid::new_v4()));
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn database_files(dir: &Path) -> Vec<String> {
    let mut found: Vec<String> = fs::read_dir(dir)
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
        .filter(|name| name.starts_with("chat.db"))
        .collect();
    found.sort();
    found
}

#[test]
fn a_wipe_with_no_open_store_removes_the_database_and_the_orphans_of_older_keys() {
    let dir = scratch();
    let first = Keychain::with_os(Box::new(SharedVault::default()), &dir);
    let store = Store::open_keyed(&database_path(&dir), &first).unwrap();
    store
        .put_conversations(&[chat(ConversationKind::Direct)])
        .unwrap();
    drop(store);
    let second = Keychain::with_os(Box::new(SharedVault::default()), &dir);
    let store = Store::open_keyed(&database_path(&dir), &second).unwrap();
    store.set_me("200").unwrap();
    drop(store);
    fs::write(dir.join("chat.db-wal"), b"wal").unwrap();
    fs::write(dir.join("chat.db-shm"), b"shm").unwrap();
    fs::write(dir.join("notify.json"), b"{}").unwrap();
    let files = database_files(&dir);
    assert!(
        files.iter().any(|name| name.starts_with("chat.db.orphan-")),
        "{files:?}"
    );

    remove_database(&dir).unwrap();
    assert!(database_files(&dir).is_empty());
    assert!(dir.join("notify.json").exists());
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_wipe_with_no_database_is_fine() {
    let dir = scratch();
    remove_database(&dir).unwrap();
    remove_database(&dir.join("gone")).unwrap();
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn clearing_local_chats_keeps_pending_server_deletes_and_notify_prefs() {
    let dir = scratch();
    let keychain = Keychain::with_os(Box::new(SharedVault::default()), &dir);
    let store = Store::open_keyed(&database_path(&dir), &keychain).unwrap();
    store.set_me("200").unwrap();
    drop(store);
    fs::write(dir.join("chat.db-wal"), b"wal").unwrap();
    fs::write(dir.join("chat.db.orphan-7"), b"older").unwrap();
    for (folder, file) in [
        ("media", "a.image"),
        ("uploads", "deletes.json"),
        ("deletes", "313030.json"),
    ] {
        fs::create_dir_all(dir.join(folder)).unwrap();
        fs::write(dir.join(folder).join(file), b"[]").unwrap();
    }
    fs::write(dir.join("notify.json"), b"{}").unwrap();

    clear_local(&dir).unwrap();
    assert!(database_files(&dir).is_empty());
    assert!(!dir.join("media").exists());
    assert!(!dir.join("uploads").exists());
    assert!(dir.join("deletes").join("313030.json").exists());
    assert!(dir.join("notify.json").exists());
    clear_local(&dir).unwrap();
    fs::remove_dir_all(dir).unwrap();
}

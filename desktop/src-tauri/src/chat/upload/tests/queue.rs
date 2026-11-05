use uuid::Uuid;

use crate::chat::upload::delete_queue::{DeleteQueue, Slot};

struct Dir(std::path::PathBuf);

impl Drop for Dir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn queue() -> (Dir, DeleteQueue) {
    let dir = std::env::temp_dir().join(format!("chat-deletes-{}", Uuid::new_v4().simple()));
    let queue = DeleteQueue::new(&dir);
    (Dir(dir), queue)
}

fn account(name: &str) -> Slot {
    Slot::Account(name.into())
}

#[test]
fn a_delete_queued_during_a_flush_survives_that_flush() {
    let (_dir, queue) = queue();
    let (a, b, c) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
    queue.add(&account("100"), &[a, b]).unwrap();
    let flushing = queue.read(&account("100"));
    queue.add(&account("100"), &[c, a]).unwrap();
    queue.settle(&account("100"), &flushing).unwrap();
    assert_eq!(queue.read(&account("100")), vec![c]);
    queue.settle(&account("100"), &[c]).unwrap();
    assert!(!queue.path(&account("100")).exists());
}

#[test]
fn accounts_keep_their_own_queues_and_odd_ids_stay_inside_the_folder() {
    let (dir, queue) = queue();
    let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
    queue.add(&account("100"), &[a]).unwrap();
    queue.add(&account("../200"), &[b]).unwrap();
    assert_eq!(queue.read(&account("100")), vec![a]);
    assert_eq!(queue.read(&account("../200")), vec![b]);
    let inside = dir.0.join("deletes");
    for slot in [account("100"), account("../200")] {
        assert_eq!(queue.path(&slot).parent(), Some(inside.as_path()));
    }
}

#[test]
fn an_unkeyed_list_from_an_older_build_moves_to_the_signed_in_account() {
    let (_dir, queue) = queue();
    let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
    queue.add(&Slot::Store, &[a, b]).unwrap();
    queue.add(&account("100"), &[b]).unwrap();
    queue.adopt("100").unwrap();
    assert_eq!(queue.read(&account("100")), vec![b, a]);
    assert!(queue.read(&Slot::Store).is_empty());
    assert!(!queue.path(&Slot::Store).exists());
}

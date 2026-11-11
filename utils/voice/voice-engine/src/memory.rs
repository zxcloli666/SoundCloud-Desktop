use std::sync::{Condvar, Mutex, MutexGuard};
use std::time::{Duration, Instant};

use voice_nlu::{Kind, Variant};
use voice_resolve::Entity;

use crate::catalog::Catalog;

const KEPT_FOR: Duration = Duration::from_secs(60);
const KEPT_MOST: usize = 32;

type Found = Result<Vec<Entity>, String>;

pub struct Memory {
    kept_for: Duration,
    slots: Mutex<Vec<Slot>>,
    answered: Condvar,
}

struct Slot {
    variants: Vec<Variant>,
    kinds: Vec<Kind>,
    since: Instant,
    found: Option<Vec<Entity>>,
}

impl Default for Memory {
    fn default() -> Self {
        Memory::keeping(KEPT_FOR)
    }
}

impl Memory {
    pub fn keeping(kept_for: Duration) -> Memory {
        Memory {
            kept_for,
            slots: Mutex::default(),
            answered: Condvar::new(),
        }
    }

    pub fn recalled(&self, variants: &[Variant], kinds: &[Kind]) -> Option<Vec<Entity>> {
        known(&self.fresh(), variants, &set(kinds))
    }

    pub fn asked(&self, catalog: &dyn Catalog, variants: &[Variant], kinds: &[Kind]) -> Found {
        let wanted = set(kinds);
        if let Some(found) = self.awaited(variants, &wanted) {
            return Ok(found);
        }
        let found = catalog.candidates(variants, kinds);
        self.answer(variants, &wanted, &found);
        found
    }

    fn awaited(&self, variants: &[Variant], kinds: &[Kind]) -> Option<Vec<Entity>> {
        let mut slots = self.fresh();
        loop {
            if let Some(found) = known(&slots, variants, kinds) {
                return Some(found);
            }
            if !slots.iter().any(|slot| slot.holds(variants, kinds)) {
                break;
            }
            let waited = self.answered.wait_timeout(slots, self.kept_for);
            slots = waited.unwrap_or_else(|poison| poison.into_inner()).0;
            self.forget(&mut slots);
        }
        slots.push(Slot {
            variants: variants.to_vec(),
            kinds: kinds.to_vec(),
            since: Instant::now(),
            found: None,
        });
        if slots.len() > KEPT_MOST {
            slots.remove(0);
        }
        None
    }

    fn answer(&self, variants: &[Variant], kinds: &[Kind], found: &Found) {
        let mut slots = self.fresh();
        let waiting = |slot: &Slot| slot.found.is_none() && slot.holds(variants, kinds);
        if let Some(at) = slots.iter().position(waiting) {
            match found {
                Ok(entities) => {
                    slots[at].found = Some(entities.clone());
                    slots[at].since = Instant::now();
                }
                Err(_) => {
                    slots.remove(at);
                }
            }
        }
        drop(slots);
        self.answered.notify_all();
    }

    fn fresh(&self) -> MutexGuard<'_, Vec<Slot>> {
        let mut slots = self
            .slots
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        self.forget(&mut slots);
        slots
    }

    fn forget(&self, slots: &mut Vec<Slot>) {
        slots.retain(|slot| slot.since.elapsed() < self.kept_for);
    }
}

impl Slot {
    fn holds(&self, variants: &[Variant], kinds: &[Kind]) -> bool {
        self.variants == variants && self.kinds == kinds
    }

    fn covers(&self, variants: &[Variant], kinds: &[Kind]) -> bool {
        self.variants == variants && kinds.iter().all(|kind| self.kinds.contains(kind))
    }
}

fn known(slots: &[Slot], variants: &[Variant], kinds: &[Kind]) -> Option<Vec<Entity>> {
    let covering = slots.iter().filter(|slot| slot.covers(variants, kinds));
    let found = covering.filter_map(|slot| slot.found.as_ref()).next()?;
    let asked = |entity: &&Entity| kinds.contains(&entity.kind);
    Some(found.iter().filter(asked).cloned().collect())
}

fn set(kinds: &[Kind]) -> Vec<Kind> {
    let asked = |kind: &Kind| kinds.contains(kind);
    Kind::ALL.into_iter().filter(asked).collect()
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::sync::atomic::{AtomicUsize, Ordering};

    use super::*;
    use crate::fixtures::{entity, variant};

    #[derive(Default)]
    struct Counted {
        asked: AtomicUsize,
        wait: Duration,
    }

    impl Catalog for Counted {
        fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Found {
            self.asked.fetch_add(1, Ordering::SeqCst);
            std::thread::sleep(self.wait);
            match variants[0].text.as_str() {
                "broken" => Err("no route".into()),
                name => Ok(kinds.iter().map(|kind| entity(*kind, name)).collect()),
            }
        }
    }

    fn kinds(found: Found) -> Vec<Kind> {
        let found = found.expect("an answer");
        found.into_iter().map(|entity| entity.kind).collect()
    }

    fn asked(catalog: &Counted) -> usize {
        catalog.asked.load(Ordering::SeqCst)
    }

    #[test]
    fn the_same_question_is_answered_from_memory_whatever_the_order_of_its_kinds() {
        let (memory, catalog) = (Memory::default(), Counted::default());
        let kino = [variant("кино")];
        let turned = [Kind::Playlist, Kind::Album, Kind::Track, Kind::Artist];
        assert_eq!(memory.recalled(&kino, &Kind::ALL), None);
        assert_eq!(kinds(memory.asked(&catalog, &kino, &Kind::ALL)), Kind::ALL);
        assert_eq!(kinds(memory.asked(&catalog, &kino, &turned)), Kind::ALL);
        assert_eq!(
            kinds(Ok(memory.recalled(&kino, &turned).unwrap())),
            Kind::ALL
        );
        assert_eq!(asked(&catalog), 1);
    }

    #[test]
    fn fewer_kinds_of_a_remembered_question_are_answered_from_it() {
        let (memory, catalog) = (Memory::default(), Counted::default());
        let kino = [variant("кино")];
        let some = [Kind::Track, Kind::Artist];
        memory.asked(&catalog, &kino, &Kind::ALL).unwrap();
        assert_eq!(
            kinds(memory.asked(&catalog, &kino, &some)),
            [Kind::Artist, Kind::Track]
        );
        let artists = memory.recalled(&kino, &[Kind::Artist]).unwrap();
        assert_eq!(artists, [entity(Kind::Artist, "кино")]);
        assert_eq!(asked(&catalog), 1);
    }

    #[test]
    fn more_kinds_or_other_variants_are_another_question() {
        let (memory, catalog) = (Memory::default(), Counted::default());
        let kino = [variant("кино")];
        memory.asked(&catalog, &kino, &[Kind::Artist]).unwrap();
        assert_eq!(memory.recalled(&kino, &Kind::ALL), None);
        assert_eq!(memory.recalled(&kino, &[Kind::Track]), None);
        assert_eq!(memory.recalled(&[variant("баста")], &[Kind::Artist]), None);
        let longer = [variant("кино"), variant("кин")];
        assert_eq!(memory.recalled(&longer, &[Kind::Artist]), None);
        assert_eq!(kinds(memory.asked(&catalog, &kino, &Kind::ALL)), Kind::ALL);
        assert_eq!(asked(&catalog), 2);
    }

    #[test]
    fn an_answer_is_forgotten_after_its_time() {
        let memory = Memory::keeping(Duration::from_millis(60));
        let catalog = Counted::default();
        let kino = [variant("кино")];
        memory.asked(&catalog, &kino, &Kind::ALL).unwrap();
        assert!(memory.recalled(&kino, &Kind::ALL).is_some());
        std::thread::sleep(Duration::from_millis(80));
        assert_eq!(memory.recalled(&kino, &Kind::ALL), None);
        memory.asked(&catalog, &kino, &Kind::ALL).unwrap();
        assert_eq!(asked(&catalog), 2);
    }

    #[test]
    fn a_failure_is_not_remembered() {
        let (memory, catalog) = (Memory::default(), Counted::default());
        let broken = [variant("broken")];
        for _ in 0..2 {
            let found = memory.asked(&catalog, &broken, &Kind::ALL);
            assert_eq!(found, Err("no route".to_string()));
            assert_eq!(memory.recalled(&broken, &Kind::ALL), None);
        }
        assert_eq!(asked(&catalog), 2);
    }

    #[test]
    fn the_same_question_asked_at_once_reaches_the_catalog_once() {
        let memory = Arc::new(Memory::default());
        let catalog = Arc::new(Counted {
            wait: Duration::from_millis(150),
            ..Counted::default()
        });
        let ask = || {
            let (memory, catalog) = (memory.clone(), catalog.clone());
            std::thread::spawn(move || memory.asked(&*catalog, &[variant("кино")], &Kind::ALL))
        };
        let first = ask();
        std::thread::sleep(Duration::from_millis(40));
        let second = ask();
        assert_eq!(kinds(first.join().unwrap()), Kind::ALL);
        assert_eq!(kinds(second.join().unwrap()), Kind::ALL);
        assert_eq!(asked(&catalog), 1);
    }

    #[test]
    fn fewer_kinds_do_not_wait_for_a_wider_question_still_in_flight() {
        let memory = Arc::new(Memory::default());
        let catalog = Arc::new(Counted {
            wait: Duration::from_millis(150),
            ..Counted::default()
        });
        let wide = {
            let (memory, catalog) = (memory.clone(), catalog.clone());
            std::thread::spawn(move || memory.asked(&*catalog, &[variant("кино")], &Kind::ALL))
        };
        std::thread::sleep(Duration::from_millis(40));
        let narrow = memory.asked(&*catalog, &[variant("кино")], &[Kind::Artist]);
        assert_eq!(asked(&catalog), 2);
        assert_eq!(kinds(narrow), [Kind::Artist]);
        assert_eq!(kinds(wide.join().unwrap()), Kind::ALL);
    }

    #[test]
    fn only_the_newest_answers_are_kept() {
        let (memory, catalog) = (Memory::default(), Counted::default());
        let name = |at: usize| [variant(&format!("name {at}"))];
        for at in 0..=KEPT_MOST {
            memory.asked(&catalog, &name(at), &Kind::ALL).unwrap();
        }
        assert_eq!(memory.recalled(&name(0), &Kind::ALL), None);
        assert!(memory.recalled(&name(1), &Kind::ALL).is_some());
        assert!(memory.recalled(&name(KEPT_MOST), &Kind::ALL).is_some());
    }
}

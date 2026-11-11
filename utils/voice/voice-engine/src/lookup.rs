use std::cell::{Cell, RefCell};
use std::sync::Arc;
use std::sync::mpsc::{Receiver, RecvTimeoutError, channel};
use std::time::{Duration, Instant};

use voice_nlu::{Kind, Variant};
use voice_resolve::{Entity, Lookup};

use crate::catalog::Catalog;
use crate::event::{Looked, Timed};
use crate::memory::Memory;

const STOPPED: &str = "the lookup stopped";

type Found = Result<Vec<Entity>, String>;

pub struct Lookups {
    catalog: Arc<dyn Catalog>,
    memory: Arc<Memory>,
    asked: Vec<Lookup>,
    found: RefCell<Vec<Option<(Found, Looked)>>>,
    arrivals: Receiver<(usize, Found, Looked)>,
    until: Option<Instant>,
    late: Cell<bool>,
    failure: RefCell<Option<String>>,
}

impl Lookups {
    pub fn start(
        catalog: &Arc<dyn Catalog>,
        memory: &Arc<Memory>,
        asked: Vec<Lookup>,
        budget: Option<Duration>,
    ) -> Self {
        let started = Instant::now();
        let (arrived, arrivals) = channel();
        let mut found = vec![None; asked.len()];
        for (at, lookup) in asked.iter().cloned().enumerate() {
            if let Some(remembered) = memory.recalled(&lookup.variants, &lookup.kinds) {
                found[at] = Some((Ok(remembered), Looked::Remembered));
                continue;
            }
            let (catalog, memory, arrived) = (catalog.clone(), memory.clone(), arrived.clone());
            let spawned = std::thread::Builder::new()
                .name("voice-lookup".into())
                .spawn(move || {
                    let found = memory.asked(&*catalog, &lookup.variants, &lookup.kinds);
                    let _ = arrived.send((at, found, Looked::In(started.elapsed())));
                });
            if let Err(error) = spawned {
                found[at] = Some((Err(error.to_string()), Looked::In(started.elapsed())));
            }
        }
        Lookups {
            catalog: catalog.clone(),
            memory: memory.clone(),
            asked,
            found: RefCell::new(found),
            arrivals,
            until: budget.map(|budget| started + budget),
            late: Cell::new(false),
            failure: RefCell::new(None),
        }
    }

    pub fn awaited(&self) -> bool {
        self.found.borrow().iter().any(Option::is_none)
    }

    pub fn late(&self) -> bool {
        self.late.get()
    }

    pub fn failure(&self) -> Option<String> {
        self.failure.take()
    }

    pub fn timed(&self, read: Duration, total: Duration) -> Timed {
        while let Ok(arrival) = self.arrivals.try_recv() {
            self.keep(arrival);
        }
        let waiting = if self.late() {
            Looked::Late
        } else {
            Looked::Unused
        };
        let looked = |found: &Option<(Found, Looked)>| match found {
            Some((_, looked)) => *looked,
            None => waiting,
        };
        Timed {
            read,
            lookups: self.found.borrow().iter().map(looked).collect(),
            total,
            ahead: None,
        }
    }

    fn keep(&self, (at, found, looked): (usize, Found, Looked)) {
        self.found.borrow_mut()[at] = Some((found, looked));
    }

    fn arrived(&self, at: usize) -> Option<Found> {
        loop {
            if let Some((found, _)) = &self.found.borrow()[at] {
                return Some(found.clone());
            }
            let left = self.until.map_or(Duration::MAX, |until| {
                until.saturating_duration_since(Instant::now())
            });
            match self.arrivals.recv_timeout(left) {
                Ok(arrival) => self.keep(arrival),
                Err(RecvTimeoutError::Timeout) => return None,
                Err(RecvTimeoutError::Disconnected) => return Some(Err(STOPPED.into())),
            }
        }
    }

    fn told(&self, found: Found) -> Vec<Entity> {
        found.unwrap_or_else(|error| {
            self.failure.replace(Some(error));
            Vec::new()
        })
    }
}

impl voice_resolve::Catalog for Lookups {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Vec<Entity> {
        if self.late() {
            return Vec::new();
        }
        let same = |lookup: &Lookup| lookup.variants == variants && lookup.kinds == kinds;
        let Some(at) = self.asked.iter().position(same) else {
            return self.told(self.memory.asked(&*self.catalog, variants, kinds));
        };
        match self.arrived(at) {
            Some(found) => self.told(found),
            None => {
                self.late.set(true);
                Vec::new()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use voice_resolve::Catalog as _;

    use super::*;
    use crate::fixtures::{entity, variant};

    const WAIT: Duration = Duration::from_millis(400);
    const BUDGET: Duration = Duration::from_millis(60);

    struct Named {
        wait: Duration,
    }

    impl Catalog for Named {
        fn candidates(&self, variants: &[Variant], _: &[Kind]) -> Found {
            let name = variants[0].text.clone();
            if name == "slow" {
                std::thread::sleep(self.wait);
            }
            if name == "broken" {
                return Err("no route".into());
            }
            Ok(vec![entity(Kind::Artist, &name)])
        }
    }

    fn lookup(text: &str) -> Lookup {
        Lookup {
            variants: vec![variant(text)],
            kinds: Kind::ALL.to_vec(),
        }
    }

    fn started(asked: &[&str], budget: Option<Duration>) -> Lookups {
        started_with(&Arc::default(), asked, budget)
    }

    fn started_with(memory: &Arc<Memory>, asked: &[&str], budget: Option<Duration>) -> Lookups {
        let catalog: Arc<dyn Catalog> = Arc::new(Named { wait: WAIT });
        let asked = asked.iter().map(|text| lookup(text)).collect();
        Lookups::start(&catalog, memory, asked, budget)
    }

    fn found(lookups: &Lookups, text: &str) -> Vec<String> {
        let asked = lookup(text);
        let found = lookups.candidates(&asked.variants, &asked.kinds);
        found.into_iter().map(|entity| entity.name).collect()
    }

    #[test]
    fn every_lookup_gets_its_own_answer() {
        let lookups = started(&["кино", "slow", "баста"], None);
        assert_eq!(found(&lookups, "slow"), ["slow"]);
        assert_eq!(found(&lookups, "баста"), ["баста"]);
        assert_eq!(found(&lookups, "кино"), ["кино"]);
        assert!(!lookups.late());
        assert_eq!(lookups.failure(), None);
    }

    #[test]
    fn a_lookup_nobody_announced_is_made_on_the_spot() {
        let lookups = started(&["кино"], None);
        assert_eq!(found(&lookups, "баста"), ["баста"]);
        assert_eq!(found(&lookups, "broken"), Vec::<String>::new());
        assert_eq!(lookups.failure().as_deref(), Some("no route"));
    }

    #[test]
    fn a_failed_lookup_finds_nothing_and_tells_why() {
        let lookups = started(&["broken", "кино"], None);
        assert_eq!(found(&lookups, "кино"), ["кино"]);
        assert_eq!(lookups.failure(), None);
        assert_eq!(found(&lookups, "broken"), Vec::<String>::new());
        assert_eq!(lookups.failure().as_deref(), Some("no route"));
    }

    #[test]
    fn after_the_budget_a_late_lookup_and_all_after_it_find_nothing() {
        let lookups = started(&["кино", "slow"], Some(BUDGET));
        assert_eq!(found(&lookups, "кино"), ["кино"]);
        assert!(!lookups.late());
        let asked = Instant::now();
        assert_eq!(found(&lookups, "slow"), Vec::<String>::new());
        assert!(asked.elapsed() < WAIT);
        assert!(lookups.late());
        assert_eq!(found(&lookups, "кино"), Vec::<String>::new());
        let timed = lookups.timed(Duration::ZERO, BUDGET);
        assert!(matches!(timed.lookups[..], [Looked::In(_), Looked::Late]));
    }

    #[test]
    fn a_lookup_that_was_not_needed_is_not_waited_for() {
        let lookups = started(&["slow", "кино"], None);
        let asked = Instant::now();
        assert_eq!(found(&lookups, "кино"), ["кино"]);
        let timed = lookups.timed(Duration::ZERO, asked.elapsed());
        assert!(asked.elapsed() < WAIT);
        assert!(matches!(timed.lookups[..], [Looked::Unused, Looked::In(_)]));
    }

    #[test]
    fn a_lookup_that_came_after_the_budget_is_remembered_for_the_next_time() {
        let memory = Arc::default();
        let lookups = started_with(&memory, &["slow"], Some(BUDGET));
        assert_eq!(found(&lookups, "slow"), Vec::<String>::new());
        assert!(lookups.late());
        let slow = lookup("slow");
        while memory.recalled(&slow.variants, &slow.kinds).is_none() {
            std::thread::sleep(BUDGET);
        }
        let again = started_with(&memory, &["slow", "кино"], Some(BUDGET));
        let asked = Instant::now();
        assert_eq!(found(&again, "slow"), ["slow"]);
        assert!(asked.elapsed() < BUDGET);
        assert_eq!(found(&again, "кино"), ["кино"]);
        let timed = again.timed(Duration::ZERO, BUDGET);
        assert!(matches!(
            timed.lookups[..],
            [Looked::Remembered, Looked::In(_)]
        ));
    }
}

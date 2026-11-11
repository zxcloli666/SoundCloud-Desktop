use std::time::{Duration, Instant};

use voice_nlu::Names;
use voice_resolve::{Bare, Boosts, Outcome as Understood, Phrase, understand};

use crate::event::{Ahead, Event, HeardEvent, Source, Timed, TurnEvent};
use crate::lookup::Lookups;
use crate::machine::{Core, Msg};
use crate::turn::Chat;
use crate::wire::{self, Origin};

pub struct Reading {
    serial: u64,
    origin: Origin,
    early: Option<Early>,
}

struct Early {
    id: String,
    heard: String,
    asked: Option<Instant>,
    held: Vec<Chat>,
}

pub struct Read {
    outcomes: Result<Vec<Understood>, String>,
    timed: Timed,
}

struct Job {
    phrase: Phrase,
    lookups: Lookups,
    bare: Bare,
    liked: Vec<String>,
    started: Instant,
    parsed: Duration,
}

impl Core {
    pub fn read(&mut self, text: String, origin: Origin) {
        let started = Instant::now();
        let phrase = Phrase::read(&text, &Names::new(&self.config.names));
        let parsed = started.elapsed();
        let talk = self.config.llm && !phrase.commands();
        let budget = talk.then_some(self.deps.timing.lookup);
        let lookups = Lookups::start(&self.deps.catalog, &self.memory, phrase.lookups(), budget);
        let ahead = talk && lookups.awaited() && origin.source != Source::Remote;
        let early = ahead.then(|| self.announce(text, origin.source));
        let job = Job {
            phrase,
            lookups,
            bare: if self.config.llm {
                Bare::Certain
            } else {
                Bare::Popular
            },
            liked: self.config.boosts.artists.clone(),
            started,
            parsed,
        };
        let serial = self.next_gen();
        let inbox = self.inbox.clone();
        self.reading = Some(Reading {
            serial,
            origin,
            early,
        });
        let spawned = std::thread::Builder::new()
            .name("voice-read".into())
            .spawn(move || {
                let _ = inbox.send(Msg::Read(serial, job.run()));
            });
        if let Err(error) = spawned {
            self.fail("network", Some(error.to_string()));
            self.go_idle();
        }
    }

    fn announce(&mut self, heard: String, source: Source) -> Early {
        let id = self.next_id();
        self.emit(Event::Heard(HeardEvent {
            id: id.clone(),
            source,
            heard: heard.clone(),
        }));
        Early {
            id,
            heard,
            asked: None,
            held: Vec::new(),
        }
    }

    pub fn hold(&mut self, id: &str, step: Chat) -> Option<Chat> {
        let early = self.reading.as_mut().and_then(|r| r.early.as_mut());
        let Some(early) = early.filter(|early| early.id == id) else {
            return Some(step);
        };
        early.asked.get_or_insert_with(Instant::now);
        early.held.push(step);
        None
    }

    pub fn understood(&mut self, serial: u64, read: Read) {
        let current = |reading: &mut Reading| reading.serial == serial;
        let Some(Reading { origin, early, .. }) = self.reading.take_if(current) else {
            return;
        };
        let Read {
            outcomes,
            mut timed,
        } = read;
        let (kept, dropped) = match early {
            Some(early) if early.fits(&outcomes) => (Some(early), None),
            early => (None, early),
        };
        timed.ahead = kept.as_ref().or(dropped.as_ref()).map(|early| Ahead {
            chat: early.asked.map(|asked| asked.elapsed()),
            kept: kept.is_some(),
        });
        self.emit(Event::Timed(timed));
        if let Some(early) = dropped {
            self.dismiss(early);
        }
        let outcomes = match outcomes {
            Ok(outcomes) => outcomes,
            Err(error) => {
                self.fail("network", Some(error));
                return self.go_idle();
            }
        };
        let ahead = kept.as_ref().map(|early| early.id.clone());
        self.begin(origin, outcomes, ahead);
        if let Some(early) = kept {
            for step in early.held {
                self.chat(early.id.clone(), step);
            }
        }
    }

    pub fn drop_reading(&mut self) {
        let early = self.reading.take().and_then(|reading| reading.early);
        if let Some(early) = early {
            self.dismiss(early);
        }
    }

    fn dismiss(&self, early: Early) {
        if early.asked.is_some() {
            self.emit(Event::Cancelled(TurnEvent { id: early.id }));
        }
    }
}

impl Early {
    fn fits(&self, outcomes: &Result<Vec<Understood>, String>) -> bool {
        match outcomes.as_deref() {
            Ok([only]) => wire::talks(only) && only.parsed.heard == self.heard,
            _ => false,
        }
    }
}

impl Job {
    fn run(self) -> Read {
        let boosts = Boosts::liked_artists(&self.liked);
        let lookups = &self.lookups;
        let mut outcomes = understand(&self.phrase, lookups, &boosts, self.bare);
        if lookups.late() {
            outcomes = understand(&self.phrase, lookups, &boosts, self.bare);
        }
        let timed = lookups.timed(self.parsed, self.started.elapsed());
        let outcomes = match lookups.failure().filter(|_| !lookups.late()) {
            Some(error) => Err(error),
            None => Ok(outcomes),
        };
        Read { outcomes, timed }
    }
}

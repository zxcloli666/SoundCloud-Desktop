use std::ops::Range;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::time::Duration;

use tokio::sync::watch;
use tokio::time::Instant;

use super::ranges::Ranges;

const NEAR: u64 = 1024 * 1024;
const STARVED: Duration = Duration::from_secs(2);

pub struct Reel {
    pub name: String,
    pub url: String,
    path: PathBuf,
    state: Mutex<State>,
    changed: watch::Sender<()>,
}

#[derive(Default)]
struct State {
    total: Option<u64>,
    have: Ranges,
    waiting: Vec<Waiter>,
    served: u64,
    end: Option<Result<(), String>>,
}

#[derive(Clone, Copy)]
struct Waiter {
    reader: u64,
    at: u64,
    since: Instant,
}

pub struct Gap {
    pub start: u64,
    pub end: Option<u64>,
    pub reader: u64,
}

struct Waiting<'a> {
    reel: &'a Reel,
    reader: u64,
}

impl Drop for Waiting<'_> {
    fn drop(&mut self) {
        let reader = self.reader;
        self.reel
            .state()
            .waiting
            .retain(|waiter| waiter.reader != reader);
    }
}

impl State {
    fn next(&self) -> Option<Waiter> {
        let newest = self.unserved().max_by_key(|waiter| waiter.reader);
        let fresh = newest.filter(|waiter| waiter.reader > self.served);
        let starved = self
            .unserved()
            .filter(Waiter::starved)
            .min_by_key(|waiter| waiter.since);
        fresh.or(starved).or(newest)
    }

    fn lowest_near(&self, at: u64) -> u64 {
        self.unserved()
            .map(|waiter| waiter.at)
            .filter(|near| (*near..*near + NEAR).contains(&at))
            .min()
            .unwrap_or(at)
    }

    fn unserved(&self) -> impl Iterator<Item = Waiter> {
        self.waiting
            .iter()
            .filter(|waiter| self.have.run_end(waiter.at).is_none())
            .copied()
    }
}

impl Waiter {
    fn starved(&self) -> bool {
        self.since.elapsed() >= STARVED
    }
}

impl Reel {
    pub fn create(dir: &Path, name: &str, url: &str) -> Result<Self, String> {
        let path = dir.join(name);
        std::fs::File::create(path.with_extension("part")).map_err(|e| e.to_string())?;
        Ok(Self {
            name: name.to_string(),
            url: url.to_string(),
            path,
            state: Mutex::default(),
            changed: watch::Sender::new(()),
        })
    }

    pub fn part(&self) -> PathBuf {
        self.path.with_extension("part")
    }

    pub fn total(&self) -> Option<u64> {
        self.state().total
    }

    pub fn loading(&self) -> bool {
        self.state().end.is_none()
    }

    pub async fn opened(&self) -> Result<(), String> {
        self.wait(|state| state.total.map(|_| ())).await
    }

    pub async fn ready(&self, reader: u64, at: u64, asked: impl Fn()) -> Result<u64, String> {
        let have = self.state().have.run_end(at);
        if let Some(end) = have {
            return Ok(end);
        }
        self.state().waiting.push(Waiter {
            reader,
            at,
            since: Instant::now(),
        });
        let _waiting = Waiting { reel: self, reader };
        asked();
        self.wait(|state| state.have.run_end(at)).await
    }

    pub fn asks_elsewhere(&self, gap: &Gap, at: u64) -> bool {
        self.state().unserved().any(|waiter| {
            let near = (at..at + NEAR).contains(&waiter.at);
            !near && (waiter.reader > gap.reader || waiter.starved())
        })
    }

    pub fn gap(&self) -> Option<Gap> {
        let mut state = self.state();
        let next = state.next();
        let from = next.map_or(0, |waiter| state.lowest_near(waiter.at));
        state.served = next.map_or(0, |waiter| waiter.reader.max(state.served));
        let reader = state.served;
        let Some(total) = state.total else {
            return Some(Gap {
                start: 0,
                end: None,
                reader,
            });
        };
        state
            .have
            .gap(from, total)
            .or_else(|| state.have.gap(0, total))
            .map(|gap| Gap {
                start: gap.start,
                end: Some(gap.end),
                reader,
            })
    }

    pub fn learn(&self, total: u64) -> Result<(), String> {
        let known = *self.state().total.get_or_insert(total);
        if known != total {
            return Err("the size changed".into());
        }
        self.changed.send_replace(());
        Ok(())
    }

    pub fn landed(&self, part: Range<u64>) {
        self.state().have.add(part);
        self.changed.send_replace(());
    }

    pub fn finish(&self) {
        let end = std::fs::rename(self.part(), &self.path).map_err(|e| e.to_string());
        self.close(end);
    }

    pub fn fail(&self, err: String) {
        std::fs::remove_file(self.part()).ok();
        self.close(Err(err));
    }

    pub fn drop_part(&self) {
        std::fs::remove_file(self.part()).ok();
    }

    fn close(&self, end: Result<(), String>) {
        self.state().end = Some(end);
        self.changed.send_replace(());
    }

    async fn wait<T>(&self, done: impl Fn(&State) -> Option<T>) -> Result<T, String> {
        let mut changed = self.changed.subscribe();
        loop {
            {
                let state = self.state();
                if let Some(found) = done(&state) {
                    return Ok(found);
                }
                if let Some(Err(err)) = &state.end {
                    return Err(err.clone());
                }
            }
            changed.changed().await.map_err(|e| e.to_string())?;
        }
    }

    fn state(&self) -> MutexGuard<'_, State> {
        match self.state.lock() {
            Ok(guard) => guard,
            Err(poison) => poison.into_inner(),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use std::sync::Arc;

    use tokio::task::JoinHandle;

    use super::{NEAR, Reel, STARVED};

    fn reel(test: &str) -> (PathBuf, Arc<Reel>) {
        let dir = std::env::temp_dir().join(format!("video-reel-{test}-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let reel = Reel::create(&dir, "a.mp4", "https://storage/video/a.mp4").unwrap();
        (dir, Arc::new(reel))
    }

    fn span(reel: &Reel) -> Option<(u64, u64)> {
        reel.gap().and_then(|gap| Some((gap.start, gap.end?)))
    }

    async fn reader(reel: &Arc<Reel>, reader: u64, at: u64) -> JoinHandle<Result<u64, String>> {
        let reel = reel.clone();
        let (asked, told) = tokio::sync::oneshot::channel();
        let asked = std::sync::Mutex::new(Some(asked));
        let task = tokio::spawn(async move {
            let tell = || {
                asked.lock().unwrap().take().map(|asked| asked.send(()));
            };
            reel.ready(reader, at, tell).await
        });
        told.await.unwrap();
        task
    }

    #[tokio::test]
    async fn a_reader_waits_for_its_byte() {
        let (dir, reel) = reel("waits");
        reel.learn(1000).unwrap();
        let task = reader(&reel, 1, 500).await;
        reel.landed(0..100);
        assert!(!task.is_finished());
        reel.landed(500..600);
        assert_eq!(task.await.unwrap(), Ok(600));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[tokio::test]
    async fn a_failed_reel_lets_its_readers_go() {
        let (dir, reel) = reel("fails");
        reel.fail("HTTP 404".into());
        assert_eq!(reel.opened().await, Err("HTTP 404".into()));
        assert!(!reel.part().exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[tokio::test]
    async fn the_next_gap_is_where_the_newest_reader_waits_and_then_the_first() {
        let (dir, reel) = reel("gaps");
        assert!(reel.gap().is_some_and(|gap| gap.end.is_none()));
        let total = NEAR * 10;
        reel.learn(total).unwrap();
        reel.landed(0..100);
        let _newest = reader(&reel, 2, NEAR * 7).await;
        let _older = reader(&reel, 1, NEAR * 3).await;
        assert_eq!(span(&reel), Some((NEAR * 7, total)));
        reel.landed(NEAR * 7..total);
        assert_eq!(span(&reel), Some((NEAR * 3, NEAR * 7)));
        reel.landed(NEAR * 3..NEAR * 7);
        assert_eq!(span(&reel), Some((100, NEAR * 3)));
        reel.landed(100..NEAR * 3);
        assert!(reel.gap().is_none());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[tokio::test]
    async fn a_reader_just_before_the_newest_is_served_on_the_way() {
        let (dir, reel) = reel("way");
        reel.learn(NEAR * 10).unwrap();
        let _whole = reader(&reel, 1, NEAR * 4).await;
        let _piece = reader(&reel, 2, NEAR * 4 + NEAR / 2).await;
        assert_eq!(span(&reel), Some((NEAR * 4, NEAR * 10)));
        assert!(!reel.asks_elsewhere(&reel.gap().unwrap(), NEAR * 4));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[tokio::test(start_paused = true)]
    async fn a_newer_reader_far_away_takes_the_loader_and_an_older_one_waits_its_turn() {
        let (dir, reel) = reel("jump");
        reel.learn(1 << 30).unwrap();
        let _older = reader(&reel, 1, 0).await;
        let first = reel.gap().unwrap();
        assert!(!reel.asks_elsewhere(&first, 0));
        let near = reader(&reel, 2, NEAR / 2).await;
        assert!(!reel.asks_elsewhere(&first, 0));
        near.abort();
        let _ = near.await;
        let _newer = reader(&reel, 3, NEAR * 40).await;
        assert!(reel.asks_elsewhere(&first, 0));

        let second = reel.gap().unwrap();
        assert_eq!((second.start, second.reader), (NEAR * 40, 3));
        reel.landed(NEAR * 40..NEAR * 41);
        assert!(!reel.asks_elsewhere(&second, NEAR * 41));
        tokio::time::sleep(STARVED).await;
        let _tail = reader(&reel, 3, NEAR * 41).await;
        assert!(reel.asks_elsewhere(&second, NEAR * 41));

        let third = reel.gap().unwrap();
        assert_eq!((third.start, third.reader), (0, 3));
        assert!(!reel.asks_elsewhere(&third, 0));
        let _newest = reader(&reel, 4, NEAR * 80).await;
        assert!(reel.asks_elsewhere(&third, 0));
        assert_eq!(reel.gap().unwrap().start, NEAR * 80);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn another_size_is_another_video() {
        let (dir, reel) = reel("size");
        assert!(reel.learn(1000).is_ok());
        assert!(reel.learn(900).is_err());
        std::fs::remove_dir_all(&dir).ok();
    }
}

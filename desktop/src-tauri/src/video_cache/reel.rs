use std::ops::Range;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use tokio::sync::watch;

use super::ranges::Ranges;

const NEAR: u64 = 384 * 1024;

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
    wanted: Option<u64>,
    end: Option<Result<(), String>>,
}

pub struct Gap {
    pub start: u64,
    pub end: Option<u64>,
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

    pub async fn ready(&self, at: u64) -> Result<u64, String> {
        self.wait(|state| state.have.run_end(at)).await
    }

    pub fn run_end(&self, at: u64) -> Option<u64> {
        self.state().have.run_end(at)
    }

    pub fn want(&self, at: u64) {
        let mut state = self.state();
        if state.have.run_end(at).is_none() {
            state.wanted = Some(at);
        }
    }

    pub fn asks_elsewhere(&self, at: u64) -> bool {
        self.state()
            .wanted
            .is_some_and(|wanted| !(at..at + NEAR).contains(&wanted))
    }

    pub fn gap(&self) -> Option<Gap> {
        let state = self.state();
        let Some(total) = state.total else {
            return Some(Gap {
                start: 0,
                end: None,
            });
        };
        let from = state.wanted.unwrap_or(0);
        state
            .have
            .gap(from, total)
            .or_else(|| state.have.gap(0, total))
            .map(|gap| Gap {
                start: gap.start,
                end: Some(gap.end),
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
        let mut state = self.state();
        state.have.add(part);
        if let Some(wanted) = state.wanted
            && state.have.run_end(wanted).is_some()
        {
            state.wanted = None;
        }
        drop(state);
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

    use super::{NEAR, Reel};

    fn reel(test: &str) -> (PathBuf, Arc<Reel>) {
        let dir = std::env::temp_dir().join(format!("video-reel-{test}-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let reel = Reel::create(&dir, "a.mp4", "https://storage/video/a.mp4").unwrap();
        (dir, Arc::new(reel))
    }

    #[tokio::test]
    async fn a_reader_waits_for_its_byte() {
        let (dir, reel) = reel("waits");
        reel.learn(1000).unwrap();
        let reader = tokio::spawn({
            let reel = reel.clone();
            async move { reel.ready(500).await }
        });
        tokio::task::yield_now().await;
        reel.landed(0..100);
        assert!(!reader.is_finished());
        reel.landed(500..600);
        assert_eq!(reader.await.unwrap(), Ok(600));
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

    #[test]
    fn the_next_gap_is_the_wanted_one_and_then_the_first() {
        let (dir, reel) = reel("gaps");
        assert!(reel.gap().is_some_and(|gap| gap.end.is_none()));
        reel.learn(1000).unwrap();
        reel.landed(0..100);
        reel.want(700);
        assert!(
            reel.gap()
                .is_some_and(|gap| gap.start == 700 && gap.end == Some(1000))
        );
        reel.landed(700..1000);
        assert!(
            reel.gap()
                .is_some_and(|gap| gap.start == 100 && gap.end == Some(700))
        );
        reel.landed(100..700);
        assert!(reel.gap().is_none());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn only_a_far_jump_asks_for_another_place() {
        let (dir, reel) = reel("jump");
        assert!(!reel.asks_elsewhere(0));
        reel.want(NEAR / 2);
        assert!(!reel.asks_elsewhere(0));
        assert!(reel.asks_elsewhere(NEAR));
        reel.want(NEAR * 4);
        assert!(reel.asks_elsewhere(0));
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

use std::path::Path;
use std::sync::Arc;

use super::reel::Reel;

const MOST_PARTS: usize = 6;

#[derive(Default)]
pub struct Desk {
    reels: Vec<Arc<Reel>>,
    front: Option<Arc<Reel>>,
    ahead: Option<Arc<Reel>>,
}

impl Desk {
    pub fn named(&self, name: &str) -> Option<Arc<Reel>> {
        self.reels.iter().find(|reel| reel.name == name).cloned()
    }

    pub fn take(&mut self, dir: &Path, name: &str, url: &str) -> Result<Arc<Reel>, String> {
        self.reels.retain(|reel| reel.loading());
        if let Some(reel) = self.named(name) {
            return Ok(reel);
        }
        let reel = Arc::new(Reel::create(dir, name, url)?);
        self.reels.push(reel.clone());
        self.trim();
        Ok(reel)
    }

    pub fn bring_front(&mut self, reel: &Arc<Reel>) {
        if self
            .ahead
            .as_ref()
            .is_some_and(|ahead| Arc::ptr_eq(ahead, reel))
        {
            self.ahead = None;
        }
        self.front = Some(reel.clone());
    }

    pub fn put_ahead(&mut self, reel: &Arc<Reel>) {
        if !self.is_front(reel) {
            self.ahead = Some(reel.clone());
        }
    }

    pub fn current(&self) -> Option<Arc<Reel>> {
        [&self.front, &self.ahead]
            .into_iter()
            .flatten()
            .find(|reel| reel.loading())
            .cloned()
    }

    fn is_front(&self, reel: &Arc<Reel>) -> bool {
        self.front
            .as_ref()
            .is_some_and(|front| Arc::ptr_eq(front, reel))
    }

    fn trim(&mut self) {
        while self.reels.len() > MOST_PARTS {
            let Some(oldest) = self.reels.iter().position(|reel| !self.is_front(reel)) else {
                return;
            };
            self.reels.remove(oldest).drop_part();
        }
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::{Desk, MOST_PARTS};

    fn temp_dir(test: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("video-desk-{test}-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn the_front_loads_first_and_the_next_one_after_it() {
        let dir = temp_dir("order");
        let mut desk = Desk::default();
        let now = desk.take(&dir, "now.mp4", "now").unwrap();
        let next = desk.take(&dir, "next.mp4", "next").unwrap();
        desk.put_ahead(&next);
        assert_eq!(desk.current().unwrap().name, "next.mp4");
        desk.bring_front(&now);
        assert_eq!(desk.current().unwrap().name, "now.mp4");
        now.finish();
        assert_eq!(desk.current().unwrap().name, "next.mp4");
        desk.bring_front(&next);
        next.finish();
        assert!(desk.current().is_none());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_failed_video_starts_over() {
        let dir = temp_dir("again");
        let mut desk = Desk::default();
        desk.take(&dir, "a.mp4", "a")
            .unwrap()
            .fail("HTTP 404".into());
        assert!(desk.take(&dir, "a.mp4", "a").unwrap().loading());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn old_parts_go_but_the_front_stays() {
        let dir = temp_dir("trim");
        let mut desk = Desk::default();
        let front = desk.take(&dir, "front.mp4", "front").unwrap();
        desk.bring_front(&front);
        for index in 0..MOST_PARTS {
            desk.take(&dir, &format!("{index}.mp4"), "url").unwrap();
        }
        assert!(desk.named("front.mp4").is_some());
        assert!(desk.named("0.mp4").is_none());
        assert!(!dir.join("0.part").exists());
        std::fs::remove_dir_all(&dir).ok();
    }
}

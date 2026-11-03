use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, channel};
use std::thread::JoinHandle;
use std::time::Duration;

use crate::device::DeviceList;

pub struct Watcher {
    pub changes: Receiver<DeviceList>,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl Watcher {
    pub fn start(interval: Duration, list: fn() -> DeviceList) -> Self {
        let (tx, changes) = channel();
        let stop = Arc::new(AtomicBool::new(false));
        let flag = stop.clone();
        let thread = std::thread::Builder::new()
            .name("voice-devices".into())
            .spawn(move || {
                let mut last = list();
                while !flag.load(Ordering::Relaxed) {
                    let started = std::time::Instant::now();
                    while started.elapsed() < interval && !flag.load(Ordering::Relaxed) {
                        std::thread::sleep(Duration::from_millis(50));
                    }
                    let now = list();
                    if now != last {
                        last = now.clone();
                        if tx.send(now).is_err() {
                            return;
                        }
                    }
                }
            })
            .ok();
        Self {
            changes,
            stop,
            thread,
        }
    }
}

impl Drop for Watcher {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

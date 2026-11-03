use std::num::NonZero;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, RecvTimeoutError, channel};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

use rodio::buffer::SamplesBuffer;
use voice_audio::RefTap;
use voice_engine::Clip;

use crate::audio::master::Master;

const PUMP_IDLE: Duration = Duration::from_millis(5);
const HUSH_POLL: Duration = Duration::from_millis(20);

pub struct MasterOutput {
    pub master: Arc<Master>,
    pub active: Arc<Mutex<Option<String>>>,
    pub tap: RefTap,
    pub pump: Mutex<Option<(Arc<AtomicBool>, JoinHandle<()>)>>,
    pub hush: Mutex<Arc<AtomicBool>>,
}

impl MasterOutput {
    pub fn new(master: Arc<Master>, active: Arc<Mutex<Option<String>>>, tap: RefTap) -> Self {
        Self {
            master,
            active,
            tap,
            pump: Mutex::new(None),
            hush: Mutex::new(Arc::new(AtomicBool::new(false))),
        }
    }

    fn stop_pump(&self) {
        let running = self.pump.lock().unwrap().take();
        if let Some((stop, thread)) = running {
            stop.store(true, Ordering::Relaxed);
            let _ = thread.join();
        }
    }
}

impl voice_engine::Output for MasterOutput {
    fn duck(&self, level: f32) {
        self.master.set_duck(level);
    }

    fn reference(&self, on: bool) {
        self.stop_pump();
        if !on {
            return;
        }
        let Some(mut reference) = self.master.attach_reference() else {
            return;
        };
        let stop = Arc::new(AtomicBool::new(false));
        let flag = stop.clone();
        let tap = self.tap.clone();
        let thread = std::thread::Builder::new()
            .name("voice-reference".into())
            .spawn(move || {
                let mut buf = vec![0.0f32; 2048];
                while !flag.load(Ordering::Relaxed) {
                    let n = reference.read(&mut buf);
                    if n == 0 {
                        std::thread::sleep(PUMP_IDLE);
                        continue;
                    }
                    tap.push(&buf[..n], 1, reference.sample_rate());
                }
            });
        if let Ok(thread) = thread {
            *self.pump.lock().unwrap() = Some((stop, thread));
        }
    }

    fn device(&self) -> Option<String> {
        self.active.lock().unwrap().clone()
    }

    fn speak(&self, clip: Clip) -> Result<Receiver<()>, String> {
        self.hush();
        let rate = NonZero::new(clip.rate).ok_or("clip has no sample rate")?;
        let source = SamplesBuffer::new(NonZero::<u16>::MIN, rate, clip.samples);
        let speech = self.master.speak(source);
        let flag = Arc::new(AtomicBool::new(false));
        *self.hush.lock().unwrap() = flag.clone();
        let (done, ended) = channel();
        std::thread::Builder::new()
            .name("voice-speech".into())
            .spawn(move || {
                loop {
                    match speech.ended().recv_timeout(HUSH_POLL) {
                        Ok(()) | Err(RecvTimeoutError::Disconnected) => break,
                        Err(RecvTimeoutError::Timeout) => {
                            if flag.load(Ordering::Relaxed) {
                                speech.stop();
                            }
                        }
                    }
                }
                let _ = done.send(());
            })
            .map_err(|e| e.to_string())?;
        Ok(ended)
    }

    fn hush(&self) {
        self.hush.lock().unwrap().store(true, Ordering::Relaxed);
    }
}

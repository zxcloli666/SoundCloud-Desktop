use std::time::{Duration, Instant};

use voice_audio::{Capture, EchoMode, Event, ListenMode, Purpose, RefTap, Request, devices};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let seconds: u64 = args.first().and_then(|s| s.parse().ok()).unwrap_or(3);
    let chosen: Vec<String> = args.iter().skip(1).cloned().collect();
    let list = devices::list();
    let request = Request {
        purpose: Purpose::Utterance,
        mode: if chosen.is_empty() {
            ListenMode::Everywhere
        } else {
            ListenMode::Chosen
        },
        chosen,
        echo: EchoMode::Off,
        noise_suppression: false,
        output: None,
    };
    let capture = Capture::new(RefTap::new());
    let session = match capture.start(&request, &list) {
        Ok(session) => session,
        Err(e) => {
            println!("start failed: {e}");
            return;
        }
    };
    for d in &session.inputs {
        println!("open {} [{}] {}", d.name, d.transport.as_str(), d.id);
    }
    let started = Instant::now();
    let (mut frames, mut peak) = (0usize, 0f32);
    let mut next = Duration::from_secs(1);
    while started.elapsed() < Duration::from_secs(seconds) {
        match session.events.recv_timeout(Duration::from_millis(100)) {
            Ok(Event::Frame { samples, .. }) => {
                assert_eq!(samples.len(), 160);
                frames += 1;
            }
            Ok(Event::Level { rms, .. }) => peak = peak.max(rms),
            Ok(Event::Selected { input }) => println!("selected {input}"),
            Ok(Event::Error(e)) => println!("error {e}"),
            Err(_) => {}
        }
        if started.elapsed() >= next {
            println!("{:?}: frames {frames} peak rms {peak:.4}", next);
            (frames, peak) = (0, 0.0);
            next += Duration::from_secs(1);
        }
    }
}

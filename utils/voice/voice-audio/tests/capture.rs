use std::sync::atomic::Ordering;
use std::sync::mpsc::RecvTimeoutError;
use std::sync::{Arc, Barrier};
use std::time::Duration;

use rand::{Rng, SeedableRng, rngs::StdRng};
use voice_audio::source::{Msg, OpenFn, SourceCtx};
use voice_audio::{
    Capture, CaptureError, Device, DeviceList, EchoMode, ErrorCode, Event, ListenMode, OutputInfo,
    Purpose, RefTap, Request, Transport,
};

fn dev(id: &str, name: &str, transport: Transport, default: bool) -> Device {
    Device {
        id: id.into(),
        name: name.into(),
        transport,
        default,
        group: None,
    }
}

fn list() -> DeviceList {
    DeviceList {
        inputs: vec![
            dev("mac", "MacBook Pro Microphone", Transport::Builtin, true),
            dev("usb", "Yeti", Transport::Usb, false),
            dev("bt", "AirPods Pro", Transport::Bluetooth, false),
        ],
        outputs: Vec::new(),
    }
}

fn request(purpose: Purpose, mode: ListenMode) -> Request {
    Request {
        purpose,
        mode,
        chosen: Vec::new(),
        echo: EchoMode::Off,
        noise_suppression: false,
        output: None,
    }
}

fn wait_stop(ctx: &SourceCtx) {
    while !ctx.stop.load(Ordering::Relaxed) {
        std::thread::sleep(Duration::from_millis(5));
    }
}

fn tone_source(rate: u32, seconds: usize, amp: f32) -> OpenFn {
    Arc::new(move |ctx: SourceCtx| {
        let _ = ctx.ready.send(Ok(()));
        let per = rate as usize / 100;
        for n in 0..seconds * 100 {
            let samples = (0..per)
                .map(|i| amp * ((n * per + i) as f32 * 0.1).sin())
                .collect();
            let _ = ctx.out.send(Msg::Chunk {
                input: ctx.input,
                samples,
                rate,
            });
        }
        wait_stop(&ctx);
    })
}

fn collect_until_idle(session: &voice_audio::Session) -> Vec<Event> {
    let mut out = Vec::new();
    loop {
        match session.events.recv_timeout(Duration::from_millis(400)) {
            Ok(event) => out.push(event),
            Err(RecvTimeoutError::Timeout) | Err(RecvTimeoutError::Disconnected) => return out,
        }
    }
}

#[test]
fn frames_are_160_samples_and_cover_the_input() {
    for rate in [48_000, 44_100, 16_000] {
        let capture = Capture::with_source(RefTap::new(), tone_source(rate, 2, 0.3));
        let session = capture
            .start(&request(Purpose::Utterance, ListenMode::Chosen), &list())
            .unwrap();
        let events = collect_until_idle(&session);
        let frames: Vec<_> = events
            .iter()
            .filter_map(|e| match e {
                Event::Frame { samples, .. } => Some(samples.len()),
                _ => None,
            })
            .collect();
        assert!(frames.iter().all(|&n| n == 160));
        assert!(
            (190..=200).contains(&frames.len()),
            "rate {rate}: {}",
            frames.len()
        );
    }
}

#[test]
fn levels_come_at_about_30_hz_with_the_right_rms() {
    let capture = Capture::with_source(RefTap::new(), tone_source(48_000, 2, 0.5));
    let session = capture
        .start(&request(Purpose::Utterance, ListenMode::Chosen), &list())
        .unwrap();
    let events = collect_until_idle(&session);
    let levels: Vec<f32> = events
        .iter()
        .filter_map(|e| match e {
            Event::Level { rms, .. } => Some(*rms),
            _ => None,
        })
        .collect();
    assert!((60..=67).contains(&levels.len()), "{}", levels.len());
    let mean = levels[10..].iter().sum::<f32>() / (levels.len() - 10) as f32;
    assert!((mean - 0.5 / 2f32.sqrt()).abs() < 0.03, "mean {mean}");
}

#[test]
fn meter_sends_levels_and_no_frames() {
    let capture = Capture::with_source(RefTap::new(), tone_source(16_000, 1, 0.2));
    let session = capture
        .start(&request(Purpose::Meter, ListenMode::Chosen), &list())
        .unwrap();
    let events = collect_until_idle(&session);
    assert!(events.iter().any(|e| matches!(e, Event::Level { .. })));
    assert!(!events.iter().any(|e| matches!(e, Event::Frame { .. })));
}

#[test]
fn bluetooth_opens_for_an_utterance_and_never_for_wake() {
    let opened = Arc::new(std::sync::Mutex::new(Vec::new()));
    let log = opened.clone();
    let source: OpenFn = Arc::new(move |ctx: SourceCtx| {
        log.lock().unwrap().push(ctx.device.id.clone());
        let _ = ctx.ready.send(Ok(()));
        wait_stop(&ctx);
    });
    let capture = Capture::with_source(RefTap::new(), source);

    let utterance = capture
        .start(
            &request(Purpose::Utterance, ListenMode::Everywhere),
            &list(),
        )
        .unwrap();
    assert!(utterance.inputs.iter().any(|d| d.id == "bt"));
    utterance.stop();

    let wake = capture
        .start(&request(Purpose::Wake, ListenMode::Everywhere), &list())
        .unwrap();
    assert!(!wake.inputs.iter().any(|d| d.id == "bt"));
    wake.stop();

    let mut log = opened.lock().unwrap().clone();
    log.sort();
    assert_eq!(log, ["bt", "mac", "mac", "usb", "usb"]);
}

#[test]
fn streams_close_when_the_session_is_dropped() {
    let alive = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let counter = alive.clone();
    let source: OpenFn = Arc::new(move |ctx: SourceCtx| {
        counter.fetch_add(1, Ordering::SeqCst);
        let _ = ctx.ready.send(Ok(()));
        wait_stop(&ctx);
        counter.fetch_sub(1, Ordering::SeqCst);
    });
    let capture = Capture::with_source(RefTap::new(), source);
    let session = capture
        .start(
            &request(Purpose::Utterance, ListenMode::Everywhere),
            &list(),
        )
        .unwrap();
    assert_eq!(alive.load(Ordering::SeqCst), 3);
    drop(session);
    assert_eq!(alive.load(Ordering::SeqCst), 0);
}

#[test]
fn open_errors_come_back_with_their_code() {
    for code in [ErrorCode::MicDenied, ErrorCode::MicBusy, ErrorCode::MicLost] {
        let source: OpenFn = Arc::new(move |ctx: SourceCtx| {
            let _ = ctx.ready.send(Err(CaptureError::new(code, "x")));
        });
        let capture = Capture::with_source(RefTap::new(), source);
        let err = capture
            .start(&request(Purpose::Utterance, ListenMode::Chosen), &list())
            .err()
            .unwrap();
        assert_eq!(err.code, code);
    }
}

#[test]
fn one_failed_input_does_not_stop_the_others() {
    let source: OpenFn = Arc::new(|ctx: SourceCtx| {
        if ctx.device.id == "usb" {
            let _ = ctx.ready.send(Err(
                CaptureError::new(ErrorCode::MicBusy, "taken").for_input("usb")
            ));
            return;
        }
        let _ = ctx.ready.send(Ok(()));
        wait_stop(&ctx);
    });
    let capture = Capture::with_source(RefTap::new(), source);
    let session = capture
        .start(&request(Purpose::Wake, ListenMode::Everywhere), &list())
        .unwrap();
    assert_eq!(session.inputs.len(), 1);
    let first = session.events.recv_timeout(Duration::from_secs(1)).unwrap();
    match first {
        Event::Error(e) => {
            assert_eq!(e.code, ErrorCode::MicBusy);
            assert_eq!(e.input.as_deref(), Some("usb"));
        }
        other => panic!("{other:?}"),
    }
}

#[test]
fn losing_the_device_mid_utterance_reports_mic_lost_and_ends() {
    let source: OpenFn = Arc::new(|ctx: SourceCtx| {
        let _ = ctx.ready.send(Ok(()));
        let _ = ctx.out.send(Msg::Chunk {
            input: ctx.input,
            samples: vec![0.1; 480],
            rate: 48_000,
        });
        let _ = ctx.out.send(Msg::Lost {
            input: ctx.input,
            error: CaptureError::new(ErrorCode::MicLost, "unplugged"),
        });
        wait_stop(&ctx);
    });
    let capture = Capture::with_source(RefTap::new(), source);
    let session = capture
        .start(&request(Purpose::Utterance, ListenMode::Chosen), &list())
        .unwrap();
    let events = collect_until_idle(&session);
    let errors: Vec<_> = events
        .iter()
        .filter_map(|e| match e {
            Event::Error(e) => Some(e.code),
            _ => None,
        })
        .collect();
    assert_eq!(errors, [ErrorCode::MicLost]);
    assert!(matches!(
        session.events.recv_timeout(Duration::from_millis(200)),
        Err(RecvTimeoutError::Disconnected)
    ));
}

fn speech_noise_source(barrier: Arc<Barrier>, noise_for: &'static [(&'static str, f32)]) -> OpenFn {
    Arc::new(move |ctx: SourceCtx| {
        let _ = ctx.ready.send(Ok(()));
        let noise_amp = noise_for
            .iter()
            .find(|(id, _)| *id == ctx.device.id)
            .map(|(_, a)| *a)
            .unwrap();
        let mut rng = StdRng::seed_from_u64(ctx.input as u64 + 1);
        for n in 0..300 {
            let speaking = n >= 120;
            let samples = (0..160)
                .map(|i| {
                    let voice = if speaking {
                        0.2 * ((n * 160 + i) as f32 * 0.2).sin()
                    } else {
                        0.0
                    };
                    voice + rng.random_range(-noise_amp..noise_amp)
                })
                .collect();
            let _ = ctx.out.send(Msg::Chunk {
                input: ctx.input,
                samples,
                rate: 16_000,
            });
            barrier.wait();
        }
        wait_stop(&ctx);
    })
}

#[test]
fn everywhere_takes_the_input_with_the_best_speech_to_noise() {
    static NOISE: [(&str, f32); 2] = [("mac", 0.08), ("usb", 0.004)];
    let source = speech_noise_source(Arc::new(Barrier::new(2)), &NOISE);
    let capture = Capture::with_source(RefTap::new(), source);
    let mut req = request(Purpose::Wake, ListenMode::Everywhere);
    req.mode = ListenMode::Chosen;
    req.chosen = vec!["mac".into(), "usb".into()];
    let session = capture.start(&req, &list()).unwrap();
    let events = collect_until_idle(&session);
    let selected: Vec<_> = events
        .iter()
        .filter_map(|e| match e {
            Event::Selected { input } => Some(input.as_str()),
            _ => None,
        })
        .collect();
    assert_eq!(selected, ["usb"]);
    let late: Vec<_> = events
        .iter()
        .filter_map(|e| match e {
            Event::Frame { input, .. } => Some(input.as_str()),
            _ => None,
        })
        .rev()
        .take(100)
        .collect();
    assert!(late.iter().all(|i| *i == "usb"));
}

fn echo_run(echo: EchoMode, output: Option<OutputInfo>, seconds: usize) -> (f32, Vec<bool>) {
    let tap = RefTap::new();
    let feed = tap.clone();
    let source: OpenFn = Arc::new(move |ctx: SourceCtx| {
        let _ = ctx.ready.send(Ok(()));
        std::thread::sleep(Duration::from_millis(100));
        let mut rng = StdRng::seed_from_u64(42);
        let delay = 800;
        let total = 16_000 * seconds;
        let reference: Vec<f32> = (0..total).map(|_| rng.random_range(-0.3..0.3)).collect();
        for start in (0..total).step_by(160) {
            feed.push(&reference[start..start + 160], 1, 16_000);
            let mic = (start..start + 160)
                .map(|i| {
                    if i >= delay {
                        0.5 * reference[i - delay]
                    } else {
                        0.0
                    }
                })
                .collect();
            let _ = ctx.out.send(Msg::Chunk {
                input: ctx.input,
                samples: mic,
                rate: 16_000,
            });
            std::thread::sleep(Duration::from_millis(10));
        }
        wait_stop(&ctx);
    });
    let capture = Capture::with_source(tap, source);
    let mut req = request(Purpose::Utterance, ListenMode::Chosen);
    req.echo = echo;
    req.output = output;
    let session = capture.start(&req, &list()).unwrap();
    let flags = session.echo_cancel.clone();
    let events = collect_until_idle(&session);
    let frames: Vec<&Vec<f32>> = events
        .iter()
        .filter_map(|e| match e {
            Event::Frame { samples, .. } => Some(samples),
            _ => None,
        })
        .collect();
    let n = frames.len();
    let tail = &frames[n.saturating_sub(100)..];
    let power = tail
        .iter()
        .flat_map(|f| f.iter())
        .map(|s| s * s)
        .sum::<f32>()
        / (tail.len() * 160) as f32;
    (power, flags)
}

#[test]
fn echo_cancel_removes_playback_when_on() {
    let (tail_on, flags) = echo_run(EchoMode::On, None, 3);
    assert_eq!(flags, [true]);
    let (tail_off, flags) = echo_run(EchoMode::Off, None, 3);
    assert_eq!(flags, [false]);
    assert!(tail_off > 0.005);
    assert!(tail_on < tail_off / 20.0, "on {tail_on} off {tail_off}");
}

#[test]
fn echo_auto_follows_the_output() {
    let speakers = OutputInfo {
        name: "MacBook Pro Speakers".into(),
        transport: Transport::Builtin,
        headphones: false,
        group: None,
    };
    let headphones = OutputInfo {
        headphones: true,
        ..speakers.clone()
    };
    let (_, on) = echo_run(EchoMode::Auto, Some(speakers), 1);
    let (_, off) = echo_run(EchoMode::Auto, Some(headphones), 1);
    assert_eq!(on, [true]);
    assert_eq!(off, [false]);
}

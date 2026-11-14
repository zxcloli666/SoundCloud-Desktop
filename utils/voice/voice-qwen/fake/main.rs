#[allow(dead_code)]
#[path = "../src/wire.rs"]
mod wire;

use std::io::{self, Write};
use std::time::Duration;

const CHUNK: usize = 2400;
const CHUNKS: usize = 5;
const BRISK: Duration = Duration::from_millis(10);
const SLOW: Duration = Duration::from_millis(150);

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let plan = std::fs::read_to_string(&args[1]).unwrap_or_default();
    let devices: Vec<(&str, &str)> = plan.lines().filter_map(|l| l.split_once(' ')).collect();
    let asked = match args.get(3) {
        Some(name) => devices.iter().position(|(device, _)| device == name),
        None => Some(0).filter(|_| !devices.is_empty()),
    };
    let mut out = io::stdout().lock();
    let Some(at) = asked else {
        let _ = wire::write(&mut out, wire::FAILED, 0, b"no such device");
        return;
    };
    let (device, behaviour) = devices[at];
    if behaviour == "absent" {
        crash();
    }
    let greeting = format!("24000\n{device}");
    let _ = wire::write(&mut out, wire::READY, 0, greeting.as_bytes());
    let level: f32 = if at == 0 { 0.5 } else { 0.25 };
    let mut input = io::stdin().lock();
    while let Ok(frame) = wire::read(&mut input) {
        if frame.kind == wire::SAY {
            speak(&mut out, frame.id, behaviour, level);
        }
    }
}

fn speak(out: &mut impl Write, id: u32, behaviour: &str, level: f32) {
    let chunk: Vec<u8> = std::iter::repeat_n(level.to_le_bytes(), CHUNK)
        .flatten()
        .collect();
    for sent in 0..CHUNKS {
        match behaviour {
            "dies" => crash(),
            "dies-late" if sent == 2 => crash(),
            "stalls" => std::thread::sleep(Duration::from_secs(3600)),
            "slow" => std::thread::sleep(SLOW),
            _ => std::thread::sleep(BRISK),
        }
        let _ = wire::write(out, wire::AUDIO, id, &chunk);
    }
    let _ = wire::write(out, wire::DONE, id, &[]);
}

fn crash() -> ! {
    eprintln!("fake: the device was lost");
    eprintln!("0 fake 0x0 speak + 12");
    eprintln!("1 fake 0x0 thread_start + 8");
    std::process::exit(1)
}

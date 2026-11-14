#![cfg(unix)]

use std::fs;
use std::path::PathBuf;
use std::time::Instant;

use voice_qwen::{CPU, Paths, Qwen, Request};

const BEST: &str = "best";

fn real() -> Option<Paths> {
    let path = |name: &str| std::env::var_os(name).map(PathBuf::from);
    let (program, talker, codec) = (
        path("SCD_QWEN")?,
        path("SCD_QWEN_TALKER")?,
        path("SCD_QWEN_CODEC")?,
    );
    let dir = std::env::temp_dir().join(format!("voice-qwen-trial-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    std::os::unix::fs::symlink(program, dir.join("scd-qwen")).unwrap();
    Some(Paths {
        program: dir.join("scd-qwen"),
        talker,
        codec,
    })
}

fn trial(speaker: &str) -> Request<'_> {
    Request {
        text: "Проверяю, как быстро получается говорить на этом компьютере.",
        speaker,
        lang: "auto",
        seed: 1,
        max_tokens: 250,
    }
}

#[test]
fn the_first_warm_up_picks_the_faster_device_and_remembers_it() {
    let Some(paths) = real() else {
        eprintln!("SCD_QWEN, SCD_QWEN_TALKER, SCD_QWEN_CODEC are not set, skipped");
        return;
    };
    let speaker = std::env::var("SCD_QWEN_SPEAKER").unwrap_or_else(|_| "loli".into());
    let mut qwen = Qwen::default();
    let best = qwen.device(&paths).unwrap();
    if best == CPU {
        eprintln!("no faster device than the CPU here, nothing to pick");
        return;
    }

    qwen.warm(&paths, &trial(&speaker), &|| true);
    assert!(
        !paths.choice().exists(),
        "a trial cut short decides nothing"
    );

    let started = Instant::now();
    qwen.warm(&paths, &trial(&speaker), &|| false);
    let chosen = fs::read_to_string(paths.choice()).unwrap();
    eprintln!("{best}: chose {chosen} in {:?}", started.elapsed());
    assert!(chosen == BEST || chosen == CPU, "{chosen}");
    assert_eq!(qwen.device(&paths).unwrap() == CPU, chosen == CPU);

    let mut later = Qwen::default();
    assert_eq!(later.device(&paths).unwrap() == CPU, chosen == CPU);
    let started = Instant::now();
    later.warm(&paths, &trial(&speaker), &|| false);
    assert!(
        started.elapsed().as_secs_f32() < 0.5,
        "a made choice is not tried again"
    );
}

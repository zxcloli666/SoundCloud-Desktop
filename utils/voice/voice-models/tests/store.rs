mod common;

use std::fs;
use std::io::Read;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;

use common::*;
use voice_models::{Cancel, Error, Fetch, FetchError, Kind, Manifest, Response, Status, Store};

fn store(f: &Fixture) -> Store {
    Store::with_manifest(
        &f.root,
        f.manifest.clone(),
        Arc::new(HttpFetch),
        fast_options(),
    )
}

fn file_on_disk(f: &Fixture, index: usize) -> std::path::PathBuf {
    f.root.join("m1").join("1").join(format!("f{index}.bin"))
}

#[test]
fn install_downloads_and_reports_progress() {
    let f = fixture("install", &[700_000, 5_000]);
    let s = store(&f);
    assert_eq!(s.status("m1").unwrap(), Status::Missing);
    let (tx, rx) = mpsc::channel();
    s.install("m1", &Cancel::new(), Some(&tx)).unwrap();
    drop(tx);
    assert_eq!(s.status("m1").unwrap(), Status::Ready);
    assert_eq!(fs::read(file_on_disk(&f, 0)).unwrap(), *f.bytes(0));
    assert_eq!(fs::read(file_on_disk(&f, 1)).unwrap(), *f.bytes(1));
    assert_eq!(s.disk_usage(), 705_000);
    let events: Vec<_> = rx.iter().collect();
    let last = events.last().unwrap();
    assert_eq!(last.model, "m1");
    assert_eq!(last.file, "f1.bin");
    assert_eq!(last.file_done, 5_000);
    assert_eq!(last.model_done, 705_000);
    assert_eq!(last.model_total, 705_000);
    assert!(
        events
            .windows(2)
            .all(|w| w[0].model_done <= w[1].model_done)
    );
}

#[test]
fn resumes_after_connection_cut() {
    let f = fixture("cut", &[900_000]);
    f.server.cut_next(300_000);
    let s = store(&f);
    s.install("m1", &Cancel::new(), None).unwrap();
    assert_eq!(fs::read(file_on_disk(&f, 0)).unwrap(), *f.bytes(0));
    let requests = f.server.requests();
    assert_eq!(requests.len(), 2);
    assert_eq!(requests[0].1, 0);
    assert_eq!(requests[1].1, 300_000);
}

#[test]
fn resumes_from_existing_part_file() {
    let f = fixture("part", &[500_000]);
    let dir = f.root.join("m1").join("1");
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join("f0.bin.part"), &f.bytes(0)[..120_000]).unwrap();
    let s = store(&f);
    assert_eq!(s.status("m1").unwrap(), Status::Partial(120_000));
    s.install("m1", &Cancel::new(), None).unwrap();
    assert_eq!(f.server.requests(), vec![(f.file_url_path(0), 120_000)]);
    assert_eq!(fs::read(file_on_disk(&f, 0)).unwrap(), *f.bytes(0));
}

#[test]
fn sha_mismatch_redownloads_once() {
    let f = fixture("sha1", &[200_000]);
    f.server.corrupt_next(&f.file_url_path(0), 1);
    let s = store(&f);
    s.install("m1", &Cancel::new(), None).unwrap();
    assert_eq!(f.server.requests().len(), 2);
    assert_eq!(fs::read(file_on_disk(&f, 0)).unwrap(), *f.bytes(0));
}

#[test]
fn sha_mismatch_twice_is_reported_and_cleaned() {
    let f = fixture("sha2", &[200_000]);
    f.server.corrupt_next(&f.file_url_path(0), 5);
    let s = store(&f);
    let err = s.install("m1", &Cancel::new(), None).unwrap_err();
    assert!(matches!(err, Error::Sha256Mismatch { .. }));
    assert_eq!(f.server.requests().len(), 2);
    assert_eq!(s.status("m1").unwrap(), Status::Missing);
}

#[test]
fn gives_up_after_retries() {
    let f = fixture("retries", &[400_000]);
    f.server.cut_always(1_000);
    let s = store(&f);
    let err = s.install("m1", &Cancel::new(), None).unwrap_err();
    assert!(matches!(err, Error::Network(_)));
    assert_eq!(f.server.requests().len(), 5);
    assert_eq!(s.status("m1").unwrap(), Status::Partial(5_000));
}

#[test]
fn missing_file_is_a_hard_error() {
    let mut f = fixture("404", &[1_000]);
    let mut models = f.manifest.models.clone();
    models[0].files[0].url = format!("{}/nope", f.server.base);
    f.manifest = Manifest::from_models(models).unwrap();
    let s = store(&f);
    let err = s.install("m1", &Cancel::new(), None).unwrap_err();
    assert!(matches!(err, Error::Http(404)));
    assert_eq!(f.server.requests().len(), 1);
}

struct CancelAfterFirstRead {
    cancel: Cancel,
}

struct CancelOnRead {
    inner: Box<dyn Read + Send>,
    cancel: Cancel,
}

impl Read for CancelOnRead {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        let n = self.inner.read(buf)?;
        self.cancel.cancel();
        Ok(n)
    }
}

impl Fetch for CancelAfterFirstRead {
    fn get(&self, url: &str, offset: u64) -> Result<Response, FetchError> {
        let r = HttpFetch.get(url, offset)?;
        Ok(Response {
            start: r.start,
            total: r.total,
            body: Box::new(CancelOnRead {
                inner: r.body,
                cancel: self.cancel.clone(),
            }),
        })
    }
}

#[test]
fn cancel_keeps_part_and_next_install_resumes() {
    let f = fixture("cancel", &[800_000]);
    let cancel = Cancel::new();
    let cancelling = Store::with_manifest(
        &f.root,
        f.manifest.clone(),
        Arc::new(CancelAfterFirstRead {
            cancel: cancel.clone(),
        }),
        fast_options(),
    );
    let err = cancelling.install("m1", &cancel, None).unwrap_err();
    assert!(matches!(err, Error::Cancelled));
    let Status::Partial(bytes) = cancelling.status("m1").unwrap() else {
        panic!("not partial")
    };
    assert!(bytes > 0 && bytes < 800_000);

    let s = store(&f);
    s.install("m1", &Cancel::new(), None).unwrap();
    assert_eq!(f.server.requests().last().unwrap().1, bytes);
    assert_eq!(fs::read(file_on_disk(&f, 0)).unwrap(), *f.bytes(0));
}

#[test]
fn cancel_before_start() {
    let f = fixture("cancel0", &[1_000]);
    let cancel = Cancel::new();
    cancel.cancel();
    let err = store(&f).install("m1", &cancel, None).unwrap_err();
    assert!(matches!(err, Error::Cancelled));
    assert!(f.server.requests().is_empty());
}

struct Gate {
    started: Mutex<mpsc::Sender<()>>,
    release: Mutex<mpsc::Receiver<()>>,
}

impl Fetch for Gate {
    fn get(&self, url: &str, offset: u64) -> Result<Response, FetchError> {
        self.started.lock().unwrap().send(()).unwrap();
        self.release.lock().unwrap().recv().unwrap();
        HttpFetch.get(url, offset)
    }
}

#[test]
fn same_model_cannot_download_twice_at_once() {
    let f = fixture("lock", &[50_000]);
    let (started_tx, started_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let gate = Gate {
        started: Mutex::new(started_tx),
        release: Mutex::new(release_rx),
    };
    let first = Arc::new(Store::with_manifest(
        &f.root,
        f.manifest.clone(),
        Arc::new(gate),
        fast_options(),
    ));
    let worker = {
        let first = first.clone();
        thread::spawn(move || first.install("m1", &Cancel::new(), None))
    };
    started_rx.recv().unwrap();

    let second = store(&f);
    assert!(matches!(
        second.install("m1", &Cancel::new(), None),
        Err(Error::Busy(_))
    ));
    assert!(matches!(second.delete("m1"), Err(Error::Busy(_))));

    release_tx.send(()).unwrap();
    worker.join().unwrap().unwrap();
    assert_eq!(second.status("m1").unwrap(), Status::Ready);
    second.install("m1", &Cancel::new(), None).unwrap();
}

#[test]
fn a_model_waits_for_a_dependency_that_downloads_elsewhere() {
    let f = fixture("shared", &[50_000]);
    let part = f.manifest.get("m1").unwrap().clone();
    let mut whole = part.clone();
    whole.id = "m2".into();
    whole.requires = vec!["m1".into()];
    let manifest = Manifest::from_models(vec![part, whole]).unwrap();
    let (started_tx, started_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let gate = Gate {
        started: Mutex::new(started_tx),
        release: Mutex::new(release_rx),
    };
    let first = Store::with_manifest(&f.root, manifest.clone(), Arc::new(gate), fast_options());
    let worker = thread::spawn(move || first.install("m1", &Cancel::new(), None));
    started_rx.recv().unwrap();

    let second = Arc::new(Store::with_manifest(
        &f.root,
        manifest,
        Arc::new(HttpFetch),
        fast_options(),
    ));
    let cancel = Cancel::new();
    let gave_up = {
        let (second, cancel) = (second.clone(), cancel.clone());
        thread::spawn(move || second.install("m2", &cancel, None))
    };
    let waiting = {
        let second = second.clone();
        thread::spawn(move || second.install("m2", &Cancel::new(), None))
    };
    thread::sleep(std::time::Duration::from_millis(300));
    assert!(!waiting.is_finished());
    cancel.cancel();
    assert!(matches!(gave_up.join().unwrap(), Err(Error::Cancelled)));

    release_tx.send(()).unwrap();
    worker.join().unwrap().unwrap();
    waiting.join().unwrap().unwrap();
    assert_eq!(second.status("m1").unwrap(), Status::Ready);
    assert_eq!(second.status("m2").unwrap(), Status::Ready);
}

#[test]
fn delete_removes_everything() {
    let f = fixture("delete", &[30_000, 40_000]);
    let s = store(&f);
    s.install("m1", &Cancel::new(), None).unwrap();
    assert_eq!(s.disk_usage(), 70_000);
    s.delete("m1").unwrap();
    assert_eq!(s.status("m1").unwrap(), Status::Missing);
    assert_eq!(s.disk_usage(), 0);
    s.delete("m1").unwrap();
}

#[test]
fn wrong_size_is_corrupted_and_install_repairs() {
    let f = fixture("size", &[60_000]);
    let s = store(&f);
    s.install("m1", &Cancel::new(), None).unwrap();
    let file = fs::OpenOptions::new()
        .write(true)
        .open(file_on_disk(&f, 0))
        .unwrap();
    file.set_len(100).unwrap();
    assert_eq!(s.status("m1").unwrap(), Status::Corrupted);
    s.install("m1", &Cancel::new(), None).unwrap();
    assert_eq!(s.status("m1").unwrap(), Status::Ready);
    assert_eq!(fs::read(file_on_disk(&f, 0)).unwrap(), *f.bytes(0));
}

#[test]
fn verify_finds_flipped_byte_and_install_repairs() {
    let f = fixture("verify", &[60_000]);
    let s = store(&f);
    s.install("m1", &Cancel::new(), None).unwrap();
    assert_eq!(s.verify("m1").unwrap(), Status::Ready);
    let mut bytes = fs::read(file_on_disk(&f, 0)).unwrap();
    bytes[10] ^= 1;
    fs::write(file_on_disk(&f, 0), bytes).unwrap();
    assert_eq!(s.status("m1").unwrap(), Status::Ready);
    assert_eq!(s.verify("m1").unwrap(), Status::Corrupted);
    assert_eq!(s.status("m1").unwrap(), Status::Missing);
    s.install("m1", &Cancel::new(), None).unwrap();
    assert_eq!(s.verify("m1").unwrap(), Status::Ready);
}

#[test]
fn old_version_dir_is_removed_after_install() {
    let f = fixture("oldver", &[10_000]);
    let stale = f.root.join("m1").join("0");
    fs::create_dir_all(&stale).unwrap();
    fs::write(stale.join("old.bin"), b"old").unwrap();
    store(&f).install("m1", &Cancel::new(), None).unwrap();
    assert!(!stale.exists());
}

#[cfg(unix)]
#[test]
fn an_executable_file_can_run_after_install() {
    use std::os::unix::fs::PermissionsExt;
    let mut f = fixture("exec", &[1000, 1000]);
    f.manifest.models[0].files[0].executable = true;
    store(&f).install("m1", &Cancel::new(), None).unwrap();
    let mode = |index| {
        fs::metadata(file_on_disk(&f, index))
            .unwrap()
            .permissions()
            .mode()
    };
    assert_eq!(mode(0) & 0o111, 0o111);
    assert_eq!(mode(1) & 0o111, 0);
}

#[test]
fn models_for_other_platforms_are_left_out() {
    let text = r#"{"models": [
        {"id": "everywhere", "version": "1", "kind": "aux", "language": "any", "license": "MIT",
         "unpacked_size": 1, "files": [{"path": "a", "size": 1, "sha256": "SHA"}]},
        {"id": "engine-here", "version": "1", "kind": "engine", "language": "any", "license": "MIT",
         "unpacked_size": 1, "platform": "here", "files": [{"path": "a", "size": 1, "sha256": "SHA", "executable": true}]},
        {"id": "engine-there", "version": "1", "kind": "engine", "language": "any", "license": "MIT",
         "unpacked_size": 1, "platform": "there", "files": [{"path": "a", "size": 1, "sha256": "SHA"}]}
    ]}"#
    .replace("SHA", &"ab".repeat(32));
    let manifest = Manifest::parse(&text).unwrap().on("here");
    let ids: Vec<&str> = manifest.models.iter().map(|m| m.id.as_str()).collect();
    assert_eq!(ids, vec!["everywhere", "engine-here"]);
    assert!(manifest.models[1].files[0].executable);
}

#[test]
fn unknown_model() {
    let f = fixture("unknown", &[10]);
    assert!(matches!(
        store(&f).status("nope"),
        Err(Error::UnknownModel(_))
    ));
}

#[test]
fn embedded_manifest_is_valid() {
    let m = Manifest::embedded();
    let vosk = m
        .get("sherpa-onnx-streaming-zipformer-small-ru-vosk-int8-2025-08-16")
        .unwrap();
    assert!(vosk.files.iter().any(|f| f.path == "bpe.vocab"));
    assert_eq!(vosk.requires, vec!["silero-vad".to_string()]);
    assert!(
        vosk.files[0]
            .url
            .starts_with("https://storage.scnative.dev/voice-models/")
    );
    let lolya = m.get("qwen-lolya").unwrap();
    assert_eq!(lolya.requires, vec!["qwen-codec".to_string()]);
    assert!(m.get("qwen-moriarty").is_ok());
}

#[test]
fn every_platform_gets_one_engine_with_one_program() {
    let text = include_str!("../manifest.json");
    for platform in [
        "macos-aarch64",
        "macos-x86_64",
        "linux-x86_64",
        "linux-aarch64",
        "windows-x86_64",
    ] {
        let manifest = Manifest::parse(text).unwrap().on(platform);
        let engines: Vec<_> = manifest
            .models
            .iter()
            .filter(|model| model.kind == Kind::Engine)
            .collect();
        assert_eq!(engines.len(), 1, "{platform}");
        let programs = engines[0].files.iter().filter(|file| file.executable);
        assert_eq!(programs.count(), 1, "{platform}");
    }
}

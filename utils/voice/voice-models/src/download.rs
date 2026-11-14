use std::fs::{self, File as FsFile, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::mpsc::Sender;
use std::thread;
use std::time::{Duration, Instant};

use sha2::{Digest, Sha256};

use crate::cancel::Cancel;
use crate::error::Error;
use crate::fetch::{Fetch, FetchError};
use crate::manifest::File;
use crate::progress::Progress;
use crate::store::Options;

const CHUNK: usize = 256 * 1024;

pub struct Report<'a> {
    pub tx: Option<&'a Sender<Progress>>,
    pub model: &'a str,
    pub model_total: u64,
    pub model_done: u64,
}

impl Report<'_> {
    fn send(&self, file: &File, file_done: u64) {
        if let Some(tx) = self.tx {
            let _ = tx.send(Progress {
                model: self.model.to_string(),
                file: file.path.clone(),
                file_done,
                file_total: file.size,
                model_done: self.model_done + file_done,
                model_total: self.model_total,
            });
        }
    }
}

pub fn part_path(dest: &Path) -> PathBuf {
    let mut name = dest.as_os_str().to_owned();
    name.push(".part");
    PathBuf::from(name)
}

pub fn download_file(
    fetch: &dyn Fetch,
    options: &Options,
    cancel: &Cancel,
    report: &Report,
    file: &File,
    dest: &Path,
) -> Result<(), Error> {
    if let Some(dir) = dest.parent() {
        fs::create_dir_all(dir)?;
    }
    let part = part_path(dest);
    let mut corrupted_once = false;
    loop {
        let digest = fetch_with_retries(fetch, options, cancel, report, file, &part)?;
        if digest == file.sha256.to_ascii_lowercase() {
            if file.executable {
                allow_running(&part)?;
            }
            fs::rename(&part, dest)?;
            sync_dir(dest);
            report.send(file, file.size);
            return Ok(());
        }
        fs::remove_file(&part)?;
        if corrupted_once {
            return Err(Error::Sha256Mismatch {
                file: file.path.clone(),
            });
        }
        corrupted_once = true;
    }
}

#[cfg(unix)]
fn allow_running(path: &Path) -> Result<(), Error> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o755))?;
    Ok(())
}

#[cfg(not(unix))]
fn allow_running(_: &Path) -> Result<(), Error> {
    Ok(())
}

fn fetch_with_retries(
    fetch: &dyn Fetch,
    options: &Options,
    cancel: &Cancel,
    report: &Report,
    file: &File,
    part: &Path,
) -> Result<String, Error> {
    let mut attempt = 0;
    loop {
        if cancel.is_cancelled() {
            return Err(Error::Cancelled);
        }
        match fetch_once(fetch, cancel, report, file, part) {
            Err(Error::Network(_)) if attempt < options.retries => {
                sleep_unless_cancelled(options.backoff * 2u32.pow(attempt), cancel)?;
                attempt += 1;
            }
            other => return other,
        }
    }
}

fn fetch_once(
    fetch: &dyn Fetch,
    cancel: &Cancel,
    report: &Report,
    file: &File,
    part: &Path,
) -> Result<String, Error> {
    let mut offset = fs::metadata(part).map(|m| m.len()).unwrap_or(0);
    if offset > file.size {
        fs::remove_file(part)?;
        offset = 0;
    }
    let mut hasher = Sha256::new();
    prime(&mut hasher, part, offset)?;

    let mut out = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(false)
        .open(part)?;
    if offset < file.size {
        let response = match fetch.get(&file.url, offset) {
            Ok(r) => r,
            Err(FetchError::Status(code)) if !FetchError::Status(code).is_retryable() => {
                return Err(Error::Http(code));
            }
            Err(e) => return Err(Error::Network(e.to_string())),
        };
        if response.total != file.size {
            return Err(Error::Network(format!(
                "server reports {} bytes, manifest says {}",
                response.total, file.size
            )));
        }
        if response.start != offset {
            if response.start != 0 {
                return Err(Error::Network(format!(
                    "asked offset {offset}, got {}",
                    response.start
                )));
            }
            hasher = Sha256::new();
            offset = 0;
        }
        out.set_len(offset)?;
        out.seek(SeekFrom::Start(offset))?;

        let mut body = response.body;
        let mut buf = vec![0u8; CHUNK];
        while offset < file.size {
            if cancel.is_cancelled() {
                return Err(Error::Cancelled);
            }
            let want = CHUNK.min((file.size - offset) as usize);
            let n = body
                .read(&mut buf[..want])
                .map_err(|e| Error::Network(e.to_string()))?;
            if n == 0 {
                out.sync_all()?;
                return Err(Error::Network("connection closed early".into()));
            }
            out.write_all(&buf[..n])?;
            hasher.update(&buf[..n]);
            offset += n as u64;
            report.send(file, offset);
        }
    }
    out.sync_all()?;
    Ok(hex(&hasher.finalize()))
}

fn prime(hasher: &mut Sha256, part: &Path, len: u64) -> Result<(), Error> {
    if len == 0 {
        return Ok(());
    }
    let mut reader = FsFile::open(part)?.take(len);
    let mut buf = vec![0u8; CHUNK];
    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 {
            return Ok(());
        }
        hasher.update(&buf[..n]);
    }
}

pub fn hash_file(path: &Path) -> Result<String, Error> {
    let mut hasher = Sha256::new();
    let len = fs::metadata(path)?.len();
    prime(&mut hasher, path, len)?;
    Ok(hex(&hasher.finalize()))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn sync_dir(path: &Path) {
    if let Some(dir) = path.parent()
        && let Ok(handle) = FsFile::open(dir)
    {
        let _ = handle.sync_all();
    }
}

fn sleep_unless_cancelled(total: Duration, cancel: &Cancel) -> Result<(), Error> {
    let start = Instant::now();
    while start.elapsed() < total {
        if cancel.is_cancelled() {
            return Err(Error::Cancelled);
        }
        thread::sleep(Duration::from_millis(10).min(total));
    }
    Ok(())
}

use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::app::diagnostics;

pub const MOVED: &str = "moved-from-roaming";
const STAGING: &str = ".moving";

pub trait Disk {
    fn rename(&self, from: &Path, to: &Path) -> io::Result<()>;
    fn copy(&self, from: &Path, to: &Path) -> io::Result<()>;
}

pub struct RealDisk;

impl Disk for RealDisk {
    fn rename(&self, from: &Path, to: &Path) -> io::Result<()> {
        fs::rename(from, to)
    }

    fn copy(&self, from: &Path, to: &Path) -> io::Result<()> {
        fs::copy(from, to).map(drop)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Moved {
    Nothing,
    Renamed,
    Copied,
    OldKept,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
struct Entry {
    path: String,
    size: u64,
    sha256: String,
}

pub fn settle(old: &Path, new: &Path, disk: &impl Disk) -> PathBuf {
    match relocate(old, new, disk) {
        Ok(Moved::OldKept) => {
            diagnostics::warn("[chat] the roaming chat folder stays next to the local one");
            new.to_path_buf()
        }
        Ok(_) => new.to_path_buf(),
        Err(error) => {
            diagnostics::warn(format!(
                "[chat] chat data stays in the roaming folder for now: {error}"
            ));
            if new.exists() {
                new.to_path_buf()
            } else {
                old.to_path_buf()
            }
        }
    }
}

pub fn relocate(old: &Path, new: &Path, disk: &impl Disk) -> io::Result<Moved> {
    if new.exists() {
        return clear_leftover(old, new);
    }
    if !old.exists() {
        return Ok(Moved::Nothing);
    }
    if let Some(parent) = new.parent() {
        fs::create_dir_all(parent)?;
    }
    match disk.rename(old, new) {
        Ok(()) => return Ok(Moved::Renamed),
        Err(error) if error.kind() == io::ErrorKind::CrossesDevices => {}
        Err(error) => return Err(error),
    }
    let staging = staging_of(new);
    if staging.exists() {
        fs::remove_dir_all(&staging)?;
    }
    if let Err(error) = stage(old, &staging, new, disk) {
        let _ = fs::remove_dir_all(&staging);
        return Err(error);
    }
    Ok(match fs::remove_dir_all(old) {
        Ok(()) => Moved::Copied,
        Err(_) => Moved::OldKept,
    })
}

fn stage(old: &Path, staging: &Path, new: &Path, disk: &impl Disk) -> io::Result<()> {
    copy_tree(old, staging, disk)?;
    let source = manifest(old)?;
    if manifest(staging)? != source {
        return Err(io::Error::other("the copy does not match the chat folder"));
    }
    fs::write(staging.join(MOVED), serde_json::to_vec(&source)?)?;
    fs::rename(staging, new)
}

fn clear_leftover(old: &Path, new: &Path) -> io::Result<Moved> {
    if !old.exists() {
        return Ok(Moved::Nothing);
    }
    let Some(moved) = recorded(new) else {
        return Ok(Moved::OldKept);
    };
    let left = manifest(old)?;
    if !left.iter().all(|entry| moved.binary_search(entry).is_ok()) {
        return Ok(Moved::OldKept);
    }
    fs::remove_dir_all(old)?;
    Ok(Moved::Copied)
}

fn recorded(new: &Path) -> Option<Vec<Entry>> {
    let raw = fs::read(new.join(MOVED)).ok()?;
    serde_json::from_slice(&raw).ok()
}

fn staging_of(new: &Path) -> PathBuf {
    let mut name = new.file_name().unwrap_or_default().to_os_string();
    name.push(STAGING);
    new.with_file_name(name)
}

fn copy_tree(from: &Path, to: &Path, disk: &impl Disk) -> io::Result<()> {
    fs::create_dir_all(to)?;
    for (name, kind) in sorted(from)? {
        let (source, target) = (from.join(&name), to.join(&name));
        if kind.is_dir() {
            copy_tree(&source, &target, disk)?;
        } else if kind.is_file() {
            disk.copy(&source, &target)?;
        } else {
            return Err(io::Error::other("a link in the chat folder"));
        }
    }
    Ok(())
}

fn manifest(root: &Path) -> io::Result<Vec<Entry>> {
    let mut entries = Vec::new();
    collect(root, "", &mut entries)?;
    entries.sort();
    Ok(entries)
}

fn collect(dir: &Path, prefix: &str, entries: &mut Vec<Entry>) -> io::Result<()> {
    for (name, kind) in sorted(dir)? {
        let path = format!("{prefix}{}", name.to_string_lossy());
        let full = dir.join(&name);
        if kind.is_dir() {
            entries.push(Entry {
                path: format!("{path}/"),
                size: 0,
                sha256: String::new(),
            });
            collect(&full, &format!("{path}/"), entries)?;
        } else {
            entries.push(Entry {
                size: fs::metadata(&full)?.len(),
                sha256: file_sha256(&full)?,
                path,
            });
        }
    }
    Ok(())
}

fn sorted(dir: &Path) -> io::Result<Vec<(std::ffi::OsString, fs::FileType)>> {
    let mut found = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        found.push((entry.file_name(), entry.file_type()?));
    }
    found.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(found)
}

fn file_sha256(path: &Path) -> io::Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
}

#[cfg(test)]
mod tests;

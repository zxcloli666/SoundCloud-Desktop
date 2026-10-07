use std::fs::{FileTimes, OpenOptions};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use super::{AudioDirs, probe_writable};

pub const ROOT_FOLDER: &str = "SoundCloud Desktop";
const PART_SUFFIX: &str = ".part";
const PROGRESS_INTERVAL: Duration = Duration::from_millis(150);

#[derive(Debug, PartialEq)]
pub enum RelocateError {
    Busy,
    Missing,
    Same,
    Nested,
    NotWritable,
    NoSpace,
    Failed,
}

impl RelocateError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Busy => "busy",
            Self::Missing => "missing",
            Self::Same => "same",
            Self::Nested => "nested",
            Self::NotWritable => "not_writable",
            Self::NoSpace => "no_space",
            Self::Failed => "failed",
        }
    }

    fn from_io(err: &std::io::Error) -> Self {
        match err.kind() {
            ErrorKind::StorageFull | ErrorKind::QuotaExceeded => Self::NoSpace,
            ErrorKind::PermissionDenied | ErrorKind::ReadOnlyFilesystem => Self::NotWritable,
            _ => Self::Failed,
        }
    }
}

#[derive(Clone, Copy, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub files: usize,
    pub total_files: usize,
    pub bytes: u64,
    pub total_bytes: u64,
}

struct Transfer {
    src: PathBuf,
    dst: PathBuf,
    len: u64,
}

pub fn root_for_pick(picked: &Path) -> PathBuf {
    if picked.file_name().is_some_and(|name| name == ROOT_FOLDER) {
        picked.to_path_buf()
    } else {
        picked.join(ROOT_FOLDER)
    }
}

pub fn validate_target(active_root: &Path, target_root: &Path) -> Result<(), RelocateError> {
    let parent = target_root.parent().ok_or(RelocateError::Missing)?;
    if !target_root.is_absolute() || !parent.is_dir() {
        return Err(RelocateError::Missing);
    }
    let active = resolved(active_root);
    let target = resolved(target_root);
    if active == target {
        return Err(RelocateError::Same);
    }
    let active_dirs = AudioDirs::under(&active);
    if active_dirs.all().iter().any(|dir| target.starts_with(dir)) || active.starts_with(&target) {
        return Err(RelocateError::Nested);
    }
    Ok(())
}

pub fn prepare_target(target_root: &Path) -> Result<AudioDirs, RelocateError> {
    let dirs = AudioDirs::under(target_root);
    dirs.create().map_err(|e| RelocateError::from_io(&e))?;
    if !probe_writable(target_root) {
        return Err(RelocateError::NotWritable);
    }
    Ok(dirs)
}

pub fn copy_cache(
    from: &AudioDirs,
    to: &AudioDirs,
    mut report: impl FnMut(Progress),
) -> Result<(), RelocateError> {
    let mut created = Vec::new();
    let result = run_passes(from, to, &mut created, &mut report);
    if result.is_err() {
        for path in created {
            std::fs::remove_file(path).ok();
        }
    }
    result
}

fn run_passes(
    from: &AudioDirs,
    to: &AudioDirs,
    created: &mut Vec<PathBuf>,
    report: &mut impl FnMut(Progress),
) -> Result<(), RelocateError> {
    let transfers = plan(from, to);
    let mut progress = Progress {
        total_files: transfers.len(),
        total_bytes: transfers.iter().map(|t| t.len).sum(),
        ..Progress::default()
    };
    report(progress);
    let mut last_report = Instant::now();
    for transfer in &transfers {
        transfer_file(transfer, created)?;
        progress.files += 1;
        progress.bytes += transfer.len;
        if last_report.elapsed() >= PROGRESS_INTERVAL {
            report(progress);
            last_report = Instant::now();
        }
    }
    report(progress);
    for transfer in plan(from, to) {
        transfer_file(&transfer, created)?;
    }
    Ok(())
}

fn plan(from: &AudioDirs, to: &AudioDirs) -> Vec<Transfer> {
    let mut transfers = Vec::new();
    for (src_dir, dst_dir) in from.all().into_iter().zip(to.all()) {
        let Ok(entries) = std::fs::read_dir(src_dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name();
            if !is_cache_artifact(&name.to_string_lossy()) {
                continue;
            }
            let Ok(meta) = entry.metadata() else {
                continue;
            };
            if !meta.is_file() {
                continue;
            }
            let dst = dst_dir.join(&name);
            if std::fs::metadata(&dst).is_ok_and(|m| m.len() == meta.len()) {
                continue;
            }
            transfers.push(Transfer {
                src: entry.path(),
                dst,
                len: meta.len(),
            });
        }
    }
    transfers
}

fn transfer_file(transfer: &Transfer, created: &mut Vec<PathBuf>) -> Result<(), RelocateError> {
    if std::fs::hard_link(&transfer.src, &transfer.dst).is_ok() {
        created.push(transfer.dst.clone());
        return Ok(());
    }
    let mut part = transfer.dst.clone().into_os_string();
    part.push(PART_SUFFIX);
    let part = PathBuf::from(part);
    let copied = std::fs::copy(&transfer.src, &part).and_then(|_| {
        copy_times(&transfer.src, &part);
        std::fs::rename(&part, &transfer.dst)
    });
    match copied {
        Ok(()) => {
            created.push(transfer.dst.clone());
            Ok(())
        }
        Err(err) if err.kind() == ErrorKind::NotFound && !transfer.src.exists() => {
            std::fs::remove_file(&part).ok();
            Ok(())
        }
        Err(err) => {
            std::fs::remove_file(&part).ok();
            Err(RelocateError::from_io(&err))
        }
    }
}

fn copy_times(src: &Path, dst: &Path) {
    let Ok(meta) = std::fs::metadata(src) else {
        return;
    };
    let mut times = FileTimes::new();
    if let Ok(accessed) = meta.accessed() {
        times = times.set_accessed(accessed);
    }
    if let Ok(modified) = meta.modified() {
        times = times.set_modified(modified);
    }
    let _ = OpenOptions::new()
        .write(true)
        .open(dst)
        .and_then(|file| file.set_times(times));
}

pub fn remove_cache_files(dirs: &AudioDirs) {
    for dir in dirs.all() {
        let Ok(entries) = std::fs::read_dir(dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if is_cache_artifact(&name) || is_leftover_temp(&name) {
                std::fs::remove_file(entry.path()).ok();
            }
        }
        std::fs::remove_dir(dir).ok();
    }
}

fn is_cache_artifact(name: &str) -> bool {
    name.ends_with(".audio") || name.ends_with(".audio.meta.json")
}

fn is_leftover_temp(name: &str) -> bool {
    name.contains(PART_SUFFIX) || name.ends_with(".tmp")
}

fn resolved(path: &Path) -> PathBuf {
    if let Ok(path) = std::fs::canonicalize(path) {
        return path;
    }
    match (path.parent(), path.file_name()) {
        (Some(parent), Some(name)) => resolved(parent).join(name),
        _ => path.to_path_buf(),
    }
}

#[cfg(test)]
#[path = "relocate_tests.rs"]
mod tests;

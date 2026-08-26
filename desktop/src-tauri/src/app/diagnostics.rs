use std::fs::{self, OpenOptions};
use std::io::Write;
use std::sync::{Mutex, OnceLock};

use chrono::Local;
use tauri::Manager;

use crate::rt::AppHandle;

const LOG_FILE_NAME: &str = "desktop.log";
static LOG_WRITE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn log_file_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|e| format!("failed to resolve app log dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create app log dir: {e}"))?;
    Ok(dir.join(LOG_FILE_NAME))
}

fn append_log_line(app: &AppHandle, line: &str) -> Result<(), String> {
    let _write_guard = LOG_WRITE_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let path = log_file_path(app)?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("failed to open log file: {e}"))?;

    writeln!(file, "{line}").map_err(|e| format!("failed to write log file: {e}"))?;
    Ok(())
}

fn format_log_line(level: &str, message: &str) -> String {
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S");
    format!("[{timestamp}] [{level}] {message}")
}

pub fn log_native(app: &AppHandle, level: &str, message: impl AsRef<str>) {
    let _ = append_log_line(app, &format_log_line(level, message.as_ref()));
}

pub fn mark_session_started(app: &AppHandle) {
    let _ = append_log_line(
        app,
        &format_log_line("INFO", "------------ SESSION STARTED -----------------"),
    );
    if let Ok(path) = log_file_path(app) {
        let _ = append_log_line(
            app,
            &format_log_line("INFO", &format!("Log file: {}", path.display())),
        );
    }
}

#[tauri::command]
pub fn diagnostics_log(app: AppHandle, level: String, message: String) -> Result<(), String> {
    append_log_line(&app, &format_log_line(&level, &message))
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticLogEntry {
    level: String,
    message: String,
}

/// Flush a frontend log burst with a single open/write cycle. Slow network
/// fan-outs used to invoke `diagnostics_log` for every warning and repeatedly
/// open the same file, adding I/O pressure exactly while the app was struggling.
#[tauri::command]
pub async fn diagnostics_log_batch(
    app: AppHandle,
    entries: Vec<DiagnosticLogEntry>,
) -> Result<(), String> {
    if entries.is_empty() {
        return Ok(());
    }

    let dir = app
        .path()
        .app_log_dir()
        .map_err(|e| format!("failed to resolve app log dir: {e}"))?;
    let lines: Vec<String> = entries
        .into_iter()
        .map(|entry| format_log_line(&entry.level, &entry.message))
        .collect();

    tokio::task::spawn_blocking(move || {
        let _write_guard = LOG_WRITE_LOCK
            .get_or_init(|| Mutex::new(()))
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        fs::create_dir_all(&dir).map_err(|e| format!("failed to create app log dir: {e}"))?;
        let path = dir.join(LOG_FILE_NAME);
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .map_err(|e| format!("failed to open log file: {e}"))?;

        for line in lines {
            writeln!(file, "{line}").map_err(|e| format!("failed to write log file: {e}"))?;
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("diagnostics log task failed: {e}"))?
}

#[cfg(target_os = "linux")]
#[derive(Default)]
struct FdSnapshot {
    open: usize,
    soft_limit: u64,
    hard_limit: u64,
    sockets: usize,
    pipes: usize,
    anon_inodes: usize,
    files: usize,
    other: usize,
}

#[cfg(target_os = "linux")]
const FD_MONITOR_INTERVAL_SECS: u64 = 15;
#[cfg(target_os = "linux")]
const FD_HIGH_WATER_LOG_MIN: usize = 256;
#[cfg(target_os = "linux")]
const FD_WARN_PCT: u64 = 70;
#[cfg(target_os = "linux")]
const FD_CRITICAL_PCT: u64 = 85;

#[cfg(target_os = "linux")]
fn read_fd_limits() -> Result<(u64, u64), String> {
    let mut limit = libc::rlimit {
        rlim_cur: 0,
        rlim_max: 0,
    };

    unsafe {
        if libc::getrlimit(libc::RLIMIT_NOFILE, &mut limit) != 0 {
            return Err("getrlimit(RLIMIT_NOFILE) failed".into());
        }
    }

    Ok((limit.rlim_cur, limit.rlim_max))
}

#[cfg(target_os = "linux")]
fn classify_fd(target: &str, snapshot: &mut FdSnapshot) {
    if target.starts_with("socket:") {
        snapshot.sockets += 1;
    } else if target.starts_with("pipe:") {
        snapshot.pipes += 1;
    } else if target.starts_with("anon_inode:") {
        snapshot.anon_inodes += 1;
    } else if target.starts_with('/') {
        snapshot.files += 1;
    } else {
        snapshot.other += 1;
    }
}

#[cfg(target_os = "linux")]
fn read_fd_snapshot() -> Result<FdSnapshot, String> {
    let (soft_limit, hard_limit) = read_fd_limits()?;
    let mut snapshot = FdSnapshot {
        soft_limit,
        hard_limit,
        ..FdSnapshot::default()
    };

    let entries =
        fs::read_dir("/proc/self/fd").map_err(|e| format!("read_dir(/proc/self/fd): {e}"))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("fd entry read failed: {e}"))?;
        snapshot.open += 1;

        let target = fs::read_link(entry.path())
            .ok()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_default();
        classify_fd(&target, &mut snapshot);
    }

    Ok(snapshot)
}

#[cfg(target_os = "linux")]
fn format_fd_snapshot(snapshot: &FdSnapshot) -> String {
    let pct = (snapshot.open as u64)
        .saturating_mul(100)
        .checked_div(snapshot.soft_limit)
        .unwrap_or(0);

    format!(
        "[FD] open={}/{} (hard={}) {}% sockets={} pipes={} anon_inode={} files={} other={}",
        snapshot.open,
        snapshot.soft_limit,
        snapshot.hard_limit,
        pct,
        snapshot.sockets,
        snapshot.pipes,
        snapshot.anon_inodes,
        snapshot.files,
        snapshot.other
    )
}

#[cfg(target_os = "linux")]
pub fn start_linux_fd_monitor(app: &AppHandle) {
    let handle = app.clone();

    tauri::async_runtime::spawn(async move {
        let mut high_water = 0usize;
        let mut last_warn_bucket = 0u64;
        let mut last_critical_bucket = 0u64;

        loop {
            let snapshot = match tauri::async_runtime::spawn_blocking(read_fd_snapshot).await {
                Ok(Ok(snapshot)) => snapshot,
                Ok(Err(err)) => {
                    log_native(&handle, "WARN", format!("[FD] Snapshot failed: {err}"));
                    tokio::time::sleep(std::time::Duration::from_secs(FD_MONITOR_INTERVAL_SECS))
                        .await;
                    continue;
                }
                Err(err) => {
                    log_native(&handle, "WARN", format!("[FD] Snapshot task failed: {err}"));
                    tokio::time::sleep(std::time::Duration::from_secs(FD_MONITOR_INTERVAL_SECS))
                        .await;
                    continue;
                }
            };

            let usage_pct = (snapshot.open as u64)
                .saturating_mul(100)
                .checked_div(snapshot.soft_limit)
                .unwrap_or(0);

            if high_water == 0 {
                high_water = snapshot.open;
                log_native(
                    &handle,
                    "INFO",
                    format!("[FD] Monitor started {}", format_fd_snapshot(&snapshot)),
                );
            } else if snapshot.open > high_water {
                high_water = snapshot.open;
                if snapshot.open >= FD_HIGH_WATER_LOG_MIN {
                    log_native(
                        &handle,
                        "INFO",
                        format!("[FD] New high-water mark {}", format_fd_snapshot(&snapshot)),
                    );
                }
            }

            if usage_pct >= FD_CRITICAL_PCT {
                let bucket = usage_pct / 2;
                if bucket > last_critical_bucket {
                    last_critical_bucket = bucket;
                    log_native(
                        &handle,
                        "ERROR",
                        format!(
                            "[FD] Critical descriptor pressure {}",
                            format_fd_snapshot(&snapshot)
                        ),
                    );
                }
            } else if usage_pct >= FD_WARN_PCT {
                let bucket = usage_pct / 5;
                if bucket > last_warn_bucket {
                    last_warn_bucket = bucket;
                    log_native(
                        &handle,
                        "WARN",
                        format!(
                            "[FD] High descriptor pressure {}",
                            format_fd_snapshot(&snapshot)
                        ),
                    );
                }
            }

            tokio::time::sleep(std::time::Duration::from_secs(FD_MONITOR_INTERVAL_SECS)).await;
        }
    });
}

#[cfg(not(target_os = "linux"))]
pub fn start_linux_fd_monitor(_app: &AppHandle) {}

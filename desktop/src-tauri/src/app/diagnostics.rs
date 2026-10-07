use std::backtrace::Backtrace;
use std::fs;
use std::path::PathBuf;

use crate::app::log_sink;
use crate::rt::AppHandle;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

fn log_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_log_dir()
        .map_err(|e| format!("failed to resolve app log dir: {e}"))
}

pub fn init_log_file(app: &AppHandle) {
    if let Err(err) = log_dir(app).and_then(|dir| log_sink::init(&dir)) {
        eprintln!("[Diagnostics] {err}");
    }
}

pub fn log_native(_app: &AppHandle, level: &str, message: impl AsRef<str>) {
    let _ = log_sink::append(level, message.as_ref());
}

pub fn log(level: &str, message: impl AsRef<str>) {
    let message = message.as_ref();
    match level {
        "ERROR" | "WARN" | "PANIC" => eprintln!("{message}"),
        _ => println!("{message}"),
    }
    let _ = log_sink::append(level, message);
}

pub fn warn(message: impl AsRef<str>) {
    log("WARN", message);
}

pub fn error(message: impl AsRef<str>) {
    log("ERROR", message);
}

pub fn install_panic_hook() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let thread = std::thread::current();
        let thread = thread.name().unwrap_or("unnamed");
        let backtrace = Backtrace::force_capture();
        let _ = log_sink::append("PANIC", &format!("thread '{thread}' {info}\n{backtrace}"));
        default_hook(info);
    }));
}

pub fn mark_session_started(app: &AppHandle) {
    let _ = log_sink::append("INFO", "------------ SESSION STARTED -----------------");
    let _ = log_sink::append(
        "INFO",
        &format!(
            "SoundCloud Desktop {} on {} {}",
            app.package_info().version,
            std::env::consts::OS,
            std::env::consts::ARCH
        ),
    );
    if let Some(path) = log_sink::path() {
        let _ = log_sink::append("INFO", &format!("Log file: {}", path.display()));
    }
}

#[tauri::command]
pub fn diagnostics_log(level: String, message: String) -> Result<(), String> {
    log_sink::append(&level, &message)
}

#[tauri::command]
pub fn diagnostics_log_dir(app: AppHandle) -> Result<String, String> {
    log_dir(&app).map(|dir| dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn diagnostics_open_log_dir(app: AppHandle) -> Result<(), String> {
    let dir = log_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create app log dir: {e}"))?;
    let target = log_sink::path()
        .filter(|path| path.exists())
        .map(|path| path.to_path_buf());
    match target {
        Some(file) => app.opener().reveal_item_in_dir(file),
        None => app
            .opener()
            .open_path(dir.to_string_lossy().into_owned(), None::<&str>),
    }
    .map_err(|e| format!("failed to open log dir: {e}"))
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

#[cfg(target_os = "linux")]
const RENDER_ENV_KEYS: [&str; 7] = [
    "XDG_SESSION_TYPE",
    "WAYLAND_DISPLAY",
    "GDK_BACKEND",
    "WEBKIT_DMABUF_RENDERER_FORCE_SHM",
    "WEBKIT_DISABLE_DMABUF_RENDERER",
    "WEBKIT_DISABLE_COMPOSITING_MODE",
    "__NV_DISABLE_EXPLICIT_SYNC",
];

#[cfg(target_os = "linux")]
pub fn log_linux_render_env(app: &AppHandle) {
    let env = RENDER_ENV_KEYS
        .iter()
        .map(|key| format!("{key}={}", std::env::var(key).unwrap_or_default()))
        .collect::<Vec<_>>()
        .join(" ");
    log_native(app, "INFO", format!("[GPU] {env}"));
}

#[cfg(not(target_os = "linux"))]
pub fn log_linux_render_env(_app: &AppHandle) {}

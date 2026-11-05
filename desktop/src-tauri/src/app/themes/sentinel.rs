use std::io;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::Manager;

use crate::rt::AppHandle;
use crate::shared::blocking::run_blocking;

const RELOAD_MARK: &str = "reload";
const ALIVE_FRESH: Duration = Duration::from_secs(5);

static ALIVE_AT: Mutex<Option<Instant>> = Mutex::new(None);
static FILE: Mutex<()> = Mutex::new(());

fn sentinel_path(data_dir: &Path) -> PathBuf {
    data_dir.join("themes").join("applying")
}

fn app_sentinel(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(sentinel_path(
        &app.path().app_data_dir().map_err(|e| e.to_string())?,
    ))
}

fn locked<T>(work: impl FnOnce() -> T) -> T {
    let _guard = FILE.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    work()
}

fn read(path: &Path) -> String {
    std::fs::read_to_string(path)
        .map(|text| text.trim().to_owned())
        .unwrap_or_default()
}

fn write(path: &Path, text: &str) -> io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, text)?;
    std::fs::rename(&tmp, path)
}

fn remove(path: &Path) -> io::Result<()> {
    match std::fs::remove_file(path) {
        Err(error) if error.kind() != io::ErrorKind::NotFound => Err(error),
        _ => Ok(()),
    }
}

fn current(path: &Path) -> String {
    locked(|| read(path))
}

fn put(path: &Path, text: &str) -> io::Result<()> {
    locked(|| write(path, text))
}

fn clear(path: &Path, expected: Option<&str>) -> io::Result<bool> {
    locked(|| {
        if expected.is_some_and(|expected| read(path) != expected) {
            return Ok(false);
        }
        remove(path).map(|()| true)
    })
}

fn mark_reload(path: &Path, expected: &str) -> io::Result<bool> {
    locked(|| {
        if expected.is_empty() || read(path) != expected {
            return Ok(false);
        }
        write(path, &format!("{expected} {RELOAD_MARK}")).map(|()| true)
    })
}

#[tauri::command]
pub fn theme_alive(alive: bool) {
    if let Ok(mut at) = ALIVE_AT.lock() {
        *at = alive.then(Instant::now);
    }
}

#[tauri::command]
pub async fn theme_sentinel_read(app: AppHandle) -> Result<String, String> {
    let path = app_sentinel(&app)?;
    run_blocking(move || current(&path)).await
}

#[tauri::command]
pub async fn theme_sentinel_write(app: AppHandle, text: String) -> Result<(), String> {
    let path = app_sentinel(&app)?;
    run_blocking(move || put(&path, &text))
        .await?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn theme_sentinel_clear(
    app: AppHandle,
    expected: Option<String>,
) -> Result<bool, String> {
    let path = app_sentinel(&app)?;
    run_blocking(move || clear(&path, expected.as_deref()))
        .await?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn theme_mark_reload(app: AppHandle, expected: String) -> Result<bool, String> {
    let path = app_sentinel(&app)?;
    run_blocking(move || mark_reload(&path, &expected))
        .await?
        .map_err(|e| e.to_string())
}

pub fn clear_applying(app: &AppHandle) {
    let hidden = crate::app::visibility::pages_hidden();
    let alive = ALIVE_AT
        .lock()
        .is_ok_and(|at| at.is_some_and(|at| hidden || at.elapsed() < ALIVE_FRESH));
    if let (true, Ok(path)) = (alive, app_sentinel(app)) {
        let _ = clear(&path, None);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const OLD_PAGE: &str = "bonbon 9f2c41 a1b2c3";
    const NEW_PAGE: &str = "bonbon 9f2c41 d4e5f6";

    fn temp_sentinel(name: &str) -> (PathBuf, PathBuf) {
        let dir = std::env::temp_dir().join(format!(
            "scd-theme-sentinel-{name}-{}",
            uuid::Uuid::new_v4()
        ));
        let path = sentinel_path(&dir);
        (dir, path)
    }

    #[test]
    fn a_reload_marks_the_page_own_sentinel() {
        let (dir, path) = temp_sentinel("own");
        put(&path, OLD_PAGE).unwrap();
        assert!(mark_reload(&path, OLD_PAGE).unwrap());
        assert_eq!(current(&path), format!("{OLD_PAGE} reload"));
        assert!(!mark_reload(&path, OLD_PAGE).unwrap());
        assert_eq!(current(&path), format!("{OLD_PAGE} reload"));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_late_mark_leaves_the_next_page_alone() {
        let (dir, path) = temp_sentinel("late");
        put(&path, NEW_PAGE).unwrap();
        assert!(!mark_reload(&path, OLD_PAGE).unwrap());
        assert_eq!(current(&path), NEW_PAGE);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn nothing_applying_marks_nothing() {
        let (dir, path) = temp_sentinel("empty");
        assert!(!mark_reload(&path, OLD_PAGE).unwrap());
        assert!(!mark_reload(&path, "").unwrap());
        assert!(!path.exists());
        assert_eq!(current(&path), "");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_page_clears_only_its_own_sentinel() {
        let (dir, path) = temp_sentinel("clear");
        put(&path, NEW_PAGE).unwrap();
        assert!(!clear(&path, Some(OLD_PAGE)).unwrap());
        assert_eq!(current(&path), NEW_PAGE);
        assert!(clear(&path, Some(NEW_PAGE)).unwrap());
        assert!(!path.exists());
        put(&path, OLD_PAGE).unwrap();
        assert!(clear(&path, None).unwrap());
        assert!(!path.exists());
        assert!(clear(&path, None).unwrap());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_mark_racing_the_next_page_never_overwrites_it() {
        let (dir, path) = temp_sentinel("race");
        for _ in 0..200 {
            put(&path, OLD_PAGE).unwrap();
            let marker = {
                let path = path.clone();
                std::thread::spawn(move || mark_reload(&path, OLD_PAGE).unwrap())
            };
            put(&path, NEW_PAGE).unwrap();
            marker.join().unwrap();
            assert_eq!(current(&path), NEW_PAGE);
        }
        std::fs::remove_dir_all(&dir).unwrap();
    }
}

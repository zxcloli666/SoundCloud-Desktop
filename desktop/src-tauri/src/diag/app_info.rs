use std::path::Path;
#[cfg(any(target_os = "macos", windows))]
use std::process::Command;
use std::sync::OnceLock;

use serde::Serialize;

use super::session;

const FILE: &str = "diag_install.txt";

static CURRENT: OnceLock<AppInfo> = OnceLock::new();

#[derive(Clone, Serialize)]
pub struct AppInfo {
    pub version: String,
    pub os: String,
    pub os_version: String,
    pub arch: String,
    pub install: String,
    pub locale: String,
    pub id: String,
}

pub fn set(info: AppInfo) {
    let _ = CURRENT.set(info);
}

pub fn current() -> AppInfo {
    let mut info = CURRENT.get().cloned().unwrap_or_else(|| AppInfo {
        version: String::new(),
        os: String::new(),
        os_version: String::new(),
        arch: String::new(),
        install: String::new(),
        locale: String::new(),
        id: String::new(),
    });
    info.locale = session::locale();
    info
}

pub fn install_id(dir: &Path) -> String {
    let path = dir.join(FILE);
    if let Ok(saved) = std::fs::read_to_string(&path) {
        let saved = saved.trim();
        if saved.len() == 12 && saved.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return saved.to_string();
        }
    }
    let id = uuid::Uuid::new_v4().simple().to_string()[..12].to_string();
    let _ = std::fs::create_dir_all(dir);
    let _ = std::fs::write(&path, &id);
    id
}

#[cfg(target_os = "macos")]
pub fn os_version() -> String {
    let output = Command::new("sw_vers").arg("-productVersion").output();
    first_number(&output.map(|output| output.stdout).unwrap_or_default())
}

#[cfg(windows)]
pub fn os_version() -> String {
    use std::os::windows::process::CommandExt;
    const NO_WINDOW: u32 = 0x0800_0000;
    let output = Command::new("cmd")
        .args(["/C", "ver"])
        .creation_flags(NO_WINDOW)
        .output();
    first_number(&output.map(|output| output.stdout).unwrap_or_default())
}

#[cfg(not(any(target_os = "macos", windows)))]
pub fn os_version() -> String {
    linux_version()
}

#[cfg(any(target_os = "macos", windows))]
fn first_number(text: &[u8]) -> String {
    String::from_utf8_lossy(text)
        .split_whitespace()
        .map(|word| word.trim_matches(|ch| ch == '[' || ch == ']'))
        .find(|word| word.starts_with(|ch: char| ch.is_ascii_digit()))
        .unwrap_or_default()
        .to_string()
}

#[cfg(not(any(target_os = "macos", windows)))]
fn linux_version() -> String {
    std::fs::read_to_string("/etc/os-release")
        .unwrap_or_default()
        .lines()
        .find_map(|line| line.strip_prefix("VERSION_ID="))
        .map(|value| value.trim_matches('"').to_string())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::install_id;

    #[test]
    fn the_install_id_is_twelve_hex_and_persists() {
        let dir = std::env::temp_dir().join(format!("scd-install-{}", uuid::Uuid::new_v4()));
        let first = install_id(&dir);
        assert_eq!(first.len(), 12);
        assert!(first.bytes().all(|byte| byte.is_ascii_hexdigit()));
        assert_eq!(install_id(&dir), first);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}

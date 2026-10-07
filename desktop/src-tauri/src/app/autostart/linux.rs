use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use super::{LOGIN_ARG, load_flag, portal, update_flag};

const ENTRY_FILE: &str = "soundcloud-desktop.desktop";
const DISABLED_MARKERS: [&str; 2] = ["Hidden=true", "X-GNOME-Autostart-enabled=false"];

fn entry_path() -> Option<PathBuf> {
    dirs::config_dir().map(|dir| dir.join("autostart").join(ENTRY_FILE))
}

fn executable() -> Result<PathBuf, String> {
    if let Some(appimage) = std::env::var_os("APPIMAGE") {
        return Ok(PathBuf::from(appimage));
    }
    std::env::current_exe().map_err(|e| e.to_string())
}

fn quote_exec(path: &Path) -> String {
    let escaped = path
        .to_string_lossy()
        .replace('\\', "\\\\\\\\")
        .replace('"', "\\\"")
        .replace('`', "\\`")
        .replace('$', "\\$")
        .replace('%', "%%");
    format!("\"{escaped}\"")
}

fn desktop_entry(exe: &Path) -> String {
    format!(
        "[Desktop Entry]\n\
         Type=Application\n\
         Name=SoundCloud Desktop\n\
         Exec={} {LOGIN_ARG}\n\
         Icon=soundcloud-desktop\n\
         Terminal=false\n\
         X-GNOME-Autostart-enabled=true\n",
        quote_exec(exe)
    )
}

fn entry_enabled(text: &str) -> bool {
    !text
        .lines()
        .any(|line| DISABLED_MARKERS.contains(&line.trim()))
}

fn write_entry(enabled: bool) -> Result<(), String> {
    let path = entry_path().ok_or("config dir is unavailable")?;
    if !enabled {
        return match std::fs::remove_file(&path) {
            Err(err) if err.kind() != ErrorKind::NotFound => Err(err.to_string()),
            _ => Ok(()),
        };
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(path, desktop_entry(&executable()?)).map_err(|e| e.to_string())
}

fn entry_exists() -> bool {
    entry_path()
        .and_then(|path| std::fs::read_to_string(path).ok())
        .is_some_and(|text| entry_enabled(&text))
}

pub fn is_enabled() -> bool {
    if portal::is_sandboxed() {
        return load_flag().portal_enabled;
    }
    entry_exists()
}

pub async fn set_enabled(enabled: bool, reason: &str) -> Result<(), String> {
    if !portal::is_sandboxed() {
        return write_entry(enabled);
    }
    let granted = portal::request_autostart(enabled, reason).await?;
    update_flag(|flag| flag.portal_enabled = granted)
}

pub fn refresh() -> Result<(), String> {
    if portal::is_sandboxed() || !entry_exists() {
        return Ok(());
    }
    write_entry(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exec_line_quotes_paths_with_spaces_and_specials() {
        let quoted = quote_exec(Path::new("/home/me/My Apps/$sc \"x\" 100%.AppImage"));
        assert_eq!(quoted, r#""/home/me/My Apps/\$sc \"x\" 100%%.AppImage""#);
    }

    #[test]
    fn entry_launches_with_the_login_arg() {
        let entry = desktop_entry(Path::new("/usr/bin/soundcloud-desktop"));
        assert!(entry.contains("Exec=\"/usr/bin/soundcloud-desktop\" --autostart\n"));
        assert!(entry_enabled(&entry));
    }

    #[test]
    fn hidden_entry_counts_as_disabled() {
        assert!(!entry_enabled("[Desktop Entry]\nHidden=true\n"));
        assert!(!entry_enabled(
            "[Desktop Entry]\nX-GNOME-Autostart-enabled=false\n"
        ));
    }
}

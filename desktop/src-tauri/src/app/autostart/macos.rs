use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use super::{APP_IDENTIFIER, LOGIN_ARG};

fn agent_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| {
        home.join("Library")
            .join("LaunchAgents")
            .join(format!("{APP_IDENTIFIER}.plist"))
    })
}

fn escape_xml(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn launch_agent(exe: &Path) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{APP_IDENTIFIER}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
        <string>{LOGIN_ARG}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>ProcessType</key>
    <string>Interactive</string>
</dict>
</plist>
"#,
        escape_xml(&exe.to_string_lossy())
    )
}

fn write_entry(enabled: bool) -> Result<(), String> {
    let path = agent_path().ok_or("home dir is unavailable")?;
    if !enabled {
        return match std::fs::remove_file(&path) {
            Err(err) if err.kind() != ErrorKind::NotFound => Err(err.to_string()),
            _ => Ok(()),
        };
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    std::fs::write(path, launch_agent(&exe)).map_err(|e| e.to_string())
}

pub fn is_enabled() -> bool {
    agent_path().is_some_and(|path| path.exists())
}

pub async fn set_enabled(enabled: bool, _reason: &str) -> Result<(), String> {
    write_entry(enabled)
}

pub fn refresh() -> Result<(), String> {
    if !is_enabled() {
        return Ok(());
    }
    write_entry(true)
}

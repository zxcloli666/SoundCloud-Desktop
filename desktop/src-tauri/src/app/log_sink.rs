use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use chrono::Local;
use regex::Regex;

const LOG_FILE_NAME: &str = "desktop.log";
const ROTATED_FILE_NAME: &str = "desktop.old.log";
const MAX_LOG_BYTES: u64 = 5 * 1024 * 1024;

static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();
static WRITE_LOCK: Mutex<()> = Mutex::new(());

pub fn init(dir: &Path) -> Result<PathBuf, String> {
    if let Some(path) = LOG_PATH.get() {
        return Ok(path.clone());
    }
    fs::create_dir_all(dir).map_err(|e| format!("failed to create app log dir: {e}"))?;
    let path = dir.join(LOG_FILE_NAME);
    rotate_if_large(&path, &dir.join(ROTATED_FILE_NAME));
    Ok(LOG_PATH.get_or_init(|| path).clone())
}

pub fn path() -> Option<&'static Path> {
    LOG_PATH.get().map(PathBuf::as_path)
}

fn rotate_if_large(path: &Path, rotated: &Path) {
    let too_large = fs::metadata(path)
        .map(|meta| meta.len() > MAX_LOG_BYTES)
        .unwrap_or(false);
    if too_large {
        let _ = fs::remove_file(rotated);
        let _ = fs::rename(path, rotated);
    }
}

pub fn format_line(level: &str, message: &str) -> String {
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S");
    format!("[{timestamp}] [{level}] {}", redact(message))
}

pub fn append(level: &str, message: &str) -> Result<(), String> {
    let path = LOG_PATH
        .get()
        .ok_or_else(|| "log file is not initialized".to_string())?;
    let line = format_line(level, message);
    let _guard = WRITE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| format!("failed to open log file: {e}"))?;
    writeln!(file, "{line}").map_err(|e| format!("failed to write log file: {e}"))
}

fn secret_query_param() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r"(?i)([?&](?:session_id|access_token|refresh_token|oauth_token|token|client_secret|client_id|secret|signature|policy|key-pair-id|x-amz-[a-z-]+)=)[^&\s\x22'<>)\]]+",
        )
        .expect("valid query redaction regex")
    })
}

fn secret_auth_header() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)\b(bearer|oauth)\s+[A-Za-z0-9._~+/=-]{8,}")
            .expect("valid auth redaction regex")
    })
}

pub fn redact(message: &str) -> String {
    let message = secret_query_param().replace_all(message, "${1}***");
    secret_auth_header()
        .replace_all(&message, "${1} ***")
        .into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_session_and_signed_url_params() {
        let line = redact(
            "GET /stream/soundcloud:tracks:1?hq&session_id=abc123&format=mp3 then https://s3.example/x.mp3?X-Amz-Signature=deadbeef&X-Amz-Credential=key%2Fdate",
        );
        assert_eq!(
            line,
            "GET /stream/soundcloud:tracks:1?hq&session_id=***&format=mp3 then https://s3.example/x.mp3?X-Amz-Signature=***&X-Amz-Credential=***"
        );
    }

    #[test]
    fn redacts_authorization_tokens() {
        assert_eq!(
            redact("Authorization: OAuth 2-123456-abcdefgh failed"),
            "Authorization: OAuth *** failed"
        );
        assert_eq!(redact("Bearer eyJhbGciOi.payload"), "Bearer ***");
    }

    #[test]
    fn keeps_plain_messages() {
        let line = "[TrackCache] downloaded soundcloud:tracks:1 via api - 120 KB in 40ms";
        assert_eq!(redact(line), line);
    }

    #[test]
    fn rotates_only_large_files() {
        let dir = std::env::temp_dir().join(format!("scd-log-sink-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join(LOG_FILE_NAME);
        let rotated = dir.join(ROTATED_FILE_NAME);

        fs::write(&path, b"small").unwrap();
        rotate_if_large(&path, &rotated);
        assert!(path.exists());
        assert!(!rotated.exists());

        fs::write(&path, vec![b'x'; (MAX_LOG_BYTES + 1) as usize]).unwrap();
        rotate_if_large(&path, &rotated);
        assert!(!path.exists());
        assert!(rotated.exists());

        fs::remove_dir_all(&dir).unwrap();
    }
}

//! Cross-platform audio transcoding via a managed `ffmpeg` binary.
//!
//! ffmpeg is acquired through the `ffmpeg-sidecar` crate: on first run it is
//! downloaded for the host OS into a writable app dir (the app is always online
//! anyway — it streams audio), and reused thereafter. A system `ffmpeg` on PATH
//! is preferred when present, sparing the download. The crate has baked-in URLs
//! for x86_64 and aarch64 on win/mac/linux (the ARM sources are third-party and
//! best-effort), so a downloaded binary is exec-tested (`ffmpeg -version`) before
//! it is trusted. When ffmpeg can't be obtained (offline, an unsupported target,
//! or a download that won't run) every entry point degrades gracefully: callers
//! keep the raw cached bytes.
//!
//! All writes are crash-safe: ffmpeg renders into a `.part` temp on the *same*
//! filesystem as the destination, which is then `rename`d into place atomically.
//! A power loss mid-render leaves only an orphan `.part` (swept on next launch);
//! a loss mid-rename leaves either the old file or the new one, never a torn one.

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{SystemTime, UNIX_EPOCH};

use tokio::process::Command;

/// AAC bitrate for re-encoded output. Matches the storage canonical (256k m4a);
/// sources that are already AAC are stream-copied and keep their original rate.
const AAC_BITRATE: &str = "256k";

fn ffmpeg_bin_name() -> &'static str {
    if cfg!(windows) {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    }
}

/// Resolve a usable ffmpeg, in order: an already-downloaded binary in
/// `install_dir`, a system `ffmpeg` on PATH, then a fresh download into
/// `install_dir`. Returns `None` when none can be obtained (cache then serves
/// raw bytes). Safe to call repeatedly — it no-ops once a binary is present.
pub async fn acquire_ffmpeg(install_dir: &Path) -> Option<PathBuf> {
    let bundled = install_dir.join(ffmpeg_bin_name());
    if bundled.is_file() && ffmpeg_runs(&bundled).await {
        return Some(bundled);
    }
    // Prefer a system ffmpeg — spares the download and is the safest bet on ARM,
    // where the crate's download sources are third-party / best-effort.
    let system = PathBuf::from("ffmpeg");
    if ffmpeg_runs(&system).await {
        return Some(system);
    }
    download_ffmpeg(install_dir).await
}

/// Whether `program -version` runs successfully — used both to detect a system
/// ffmpeg and to exec-test a freshly downloaded binary (rejects a wrong-arch or
/// corrupt download before we trust it).
async fn ffmpeg_runs(program: &Path) -> bool {
    let mut cmd = Command::new(program);
    cmd.arg("-version")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    matches!(cmd.status().await, Ok(status) if status.success())
}

/// Download + unpack the host-appropriate ffmpeg into `install_dir`, then verify
/// it runs. Blocking work (ureq + archive extraction) runs off the async runtime.
/// Returns `None` on an unsupported target, a failed download, or a binary that
/// won't execute (e.g. a wrong-arch ARM build) — handled gracefully upstream.
async fn download_ffmpeg(install_dir: &Path) -> Option<PathBuf> {
    let dir = install_dir.to_path_buf();
    let result = tokio::task::spawn_blocking(move || -> Result<(), String> {
        use ffmpeg_sidecar::download::{
            download_ffmpeg_package, ffmpeg_download_url, unpack_ffmpeg_without_extras,
        };
        std::fs::create_dir_all(&dir).map_err(|e| format!("create ffmpeg dir: {e}"))?;
        let url = ffmpeg_download_url().map_err(|e| e.to_string())?;
        let archive = download_ffmpeg_package(url, &dir).map_err(|e| e.to_string())?;
        unpack_ffmpeg_without_extras(&archive, &dir).map_err(|e| e.to_string())?;
        std::fs::remove_file(&archive).ok();
        Ok(())
    })
        .await;

    match result {
        Ok(Ok(())) => {
            let bin = install_dir.join(ffmpeg_bin_name());
            if bin.is_file() && ffmpeg_runs(&bin).await {
                Some(bin)
            } else {
                eprintln!("[Transcode] downloaded ffmpeg does not run — discarding");
                tokio::fs::remove_file(&bin).await.ok();
                None
            }
        }
        Ok(Err(e)) => {
            eprintln!("[Transcode] ffmpeg download failed: {e}");
            None
        }
        Err(e) => {
            eprintln!("[Transcode] ffmpeg download task panicked: {e}");
            None
        }
    }
}

fn nonce() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
}

/// A sibling temp path in `dir` so the final `rename` stays on one filesystem.
fn temp_sibling(dir: &Path, stem: &str, ext: &str) -> PathBuf {
    dir.join(format!("{stem}.{}.part.{ext}", nonce()))
}

/// True when the payload is an ISO-BMFF (mp4/m4a) container — `....ftyp` at
/// offset 4. SoundCloud's AAC (progressive and HLS-with-init) arrives this way,
/// so it can be stream-copied into m4a instead of re-encoded.
fn is_mp4_container(prefix: &[u8]) -> bool {
    prefix.len() >= 8 && &prefix[4..8] == b"ftyp"
}

/// Read just the first `len` bytes of `path` (not the whole file) for a cheap
/// magic-byte sniff.
async fn sniff_head(path: &Path, len: usize) -> Vec<u8> {
    use tokio::io::AsyncReadExt;
    let Ok(mut file) = tokio::fs::File::open(path).await else {
        return Vec::new();
    };
    let mut buf = vec![0u8; len];
    match file.read(&mut buf).await {
        Ok(n) => {
            buf.truncate(n);
            buf
        }
        Err(_) => Vec::new(),
    }
}

/// Whether `path` is already an m4a/mp4 (AAC) container — a valid m4a as-is.
pub async fn is_m4a(path: &Path) -> bool {
    is_mp4_container(&sniff_head(path, 16).await)
}

fn base_command(ffmpeg: &Path) -> Command {
    let mut cmd = Command::new(ffmpeg);
    cmd.args(["-nostdin", "-hide_banner", "-loglevel", "error", "-y"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        // CREATE_NO_WINDOW — don't flash a console on Windows.
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    cmd
}

async fn run(mut cmd: Command, what: &str) -> Result<(), String> {
    let output = cmd
        .output()
        .await
        .map_err(|e| format!("{what}: spawn ffmpeg: {e}"))?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    let tail: String = stderr.lines().rev().take(3).collect::<Vec<_>>().join(" | ");
    Err(format!("{what}: ffmpeg exit {}: {tail}", output.status))
}

/// Transcode (or stream-copy) `input` into a canonical m4a at
/// `out_dir/final_name`, atomically. Already-AAC payloads are copied (near-free);
/// everything else is encoded to AAC. The temp render is always cleaned up.
pub async fn transcode_to_m4a(
    ffmpeg: &Path,
    input: &Path,
    out_dir: &Path,
    final_name: &str,
) -> Result<PathBuf, String> {
    let final_path = out_dir.join(final_name);
    let tmp = temp_sibling(out_dir, final_name, "m4a");

    let head = sniff_head(input, 16).await;
    let can_copy = is_mp4_container(&head);

    let mut copied = false;
    if can_copy {
        let mut cmd = base_command(ffmpeg);
        cmd.arg("-i").arg(input).args([
            "-vn",
            "-c:a",
            "copy",
            "-movflags",
            "+faststart",
        ]);
        cmd.arg(&tmp);
        match run(cmd, "remux").await {
            Ok(()) => copied = true,
            Err(e) => {
                // Copy can fail on exotic AAC profiles — fall through to encode.
                tokio::fs::remove_file(&tmp).await.ok();
                eprintln!("[Transcode] copy failed, re-encoding: {e}");
            }
        }
    }

    if !copied {
        let mut cmd = base_command(ffmpeg);
        cmd.arg("-i").arg(input).args([
            "-vn",
            "-c:a",
            "aac",
            "-b:a",
            AAC_BITRATE,
            "-movflags",
            "+faststart",
        ]);
        cmd.arg(&tmp);
        if let Err(e) = run(cmd, "encode").await {
            tokio::fs::remove_file(&tmp).await.ok();
            return Err(e);
        }
    }

    match tokio::fs::rename(&tmp, &final_path).await {
        Ok(()) => Ok(final_path),
        Err(e) => {
            tokio::fs::remove_file(&tmp).await.ok();
            Err(format!("commit transcode: {e}"))
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    M4a,
    Mp3,
}

impl ExportFormat {
    pub fn extension(self) -> &'static str {
        match self {
            ExportFormat::M4a => "m4a",
            ExportFormat::Mp3 => "mp3",
        }
    }
}

#[derive(Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportTags {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub artist: Option<String>,
}

const MP3_VBR_QUALITY: &str = "0";

pub async fn has_mp3_encoder(ffmpeg: &Path) -> bool {
    let mut cmd = Command::new(ffmpeg);
    cmd.args(["-hide_banner", "-encoders"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    match cmd.output().await {
        Ok(out) => String::from_utf8_lossy(&out.stdout).contains("libmp3lame"),
        Err(_) => false,
    }
}

fn export_args(format: ExportFormat, with_cover: bool) -> Vec<&'static str> {
    let mut args = vec!["-map", "0:a"];
    if with_cover {
        args.extend(["-map", "1:v", "-c:v", "copy"]);
    }
    match format {
        ExportFormat::M4a => {
            args.extend(["-c:a", "copy"]);
            if with_cover {
                args.extend(["-disposition:v:0", "attached_pic"]);
            }
            args.extend(["-movflags", "+faststart"]);
        }
        ExportFormat::Mp3 => {
            args.extend([
                "-c:a",
                "libmp3lame",
                "-q:a",
                MP3_VBR_QUALITY,
                "-id3v2_version",
                "3",
            ]);
            if with_cover {
                args.extend(["-metadata:s:v", "comment=Cover (front)"]);
            }
        }
    }
    args
}

fn tag_args(tags: &ExportTags) -> Vec<String> {
    [("title", &tags.title), ("artist", &tags.artist)]
        .into_iter()
        .filter_map(|(key, value)| {
            let value = value.as_deref()?.trim();
            (!value.is_empty()).then(|| format!("{key}={value}"))
        })
        .flat_map(|pair| ["-metadata".to_string(), pair])
        .collect()
}

pub async fn export_with_cover(
    ffmpeg: &Path,
    audio: &Path,
    cover: Option<&[u8]>,
    dest: &Path,
    format: ExportFormat,
    tags: &ExportTags,
) -> Result<(), String> {
    let dest_dir = dest.parent().ok_or("export: dest has no parent dir")?;
    let stem = dest
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("export");
    let tmp = temp_sibling(dest_dir, stem, format.extension());

    let cover_tmp = match cover {
        Some(bytes) if !bytes.is_empty() => {
            let p = dest_dir.join(format!("{stem}.{}.cover", nonce()));
            if tokio::fs::write(&p, bytes).await.is_ok() {
                Some(p)
            } else {
                None
            }
        }
        _ => None,
    };

    let mut cmd = base_command(ffmpeg);
    cmd.arg("-i").arg(audio);
    if let Some(ref cover_path) = cover_tmp {
        cmd.arg("-i").arg(cover_path);
    }
    cmd.args(export_args(format, cover_tmp.is_some()));
    cmd.args(tag_args(tags));
    cmd.arg(&tmp);

    let result = run(cmd, "export").await;
    if let Some(cover_path) = cover_tmp {
        tokio::fs::remove_file(&cover_path).await.ok();
    }
    if let Err(e) = result {
        tokio::fs::remove_file(&tmp).await.ok();
        return Err(e);
    }

    match tokio::fs::rename(&tmp, dest).await {
        Ok(()) => Ok(()),
        Err(rename_err) => match tokio::fs::copy(&tmp, dest).await {
            Ok(_) => {
                tokio::fs::remove_file(&tmp).await.ok();
                Ok(())
            }
            Err(copy_err) => {
                tokio::fs::remove_file(&tmp).await.ok();
                Err(format!("commit export: {rename_err}; {copy_err}"))
            }
        },
    }
}

/// Probe a media file's duration in milliseconds via ffmpeg's `Duration:` line.
/// Used to validate cached files against the API-reported length. `None` when
/// ffmpeg is unavailable or the line can't be parsed.
pub async fn probe_duration_ms(ffmpeg: &Path, path: &Path) -> Option<u64> {
    let mut cmd = Command::new(ffmpeg);
    cmd.args(["-nostdin", "-hide_banner", "-i"])
        .arg(path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    // `-i` with no output makes ffmpeg exit non-zero after printing metadata; we
    // only care about the stderr it emits, not the status.
    let output = cmd.output().await.ok()?;
    let stderr = String::from_utf8_lossy(&output.stderr);
    parse_duration_ms(&stderr)
}

/// Parse `Duration: HH:MM:SS.ss` out of ffmpeg's stderr into milliseconds.
fn parse_duration_ms(stderr: &str) -> Option<u64> {
    let idx = stderr.find("Duration:")?;
    let rest = stderr[idx + "Duration:".len()..].trim_start();
    let token = rest.split(',').next()?.trim();
    if token.starts_with("N/A") {
        return None;
    }
    let mut parts = token.split(':');
    let hours: u64 = parts.next()?.trim().parse().ok()?;
    let minutes: u64 = parts.next()?.trim().parse().ok()?;
    let secs_str = parts.next()?.trim();
    let secs: f64 = secs_str.parse().ok()?;
    let total_ms = (hours * 3600 + minutes * 60) as f64 * 1000.0 + secs * 1000.0;
    Some(total_ms.round() as u64)
}

#[cfg(test)]
mod tests {
    use super::{
        ExportFormat, ExportTags, export_args, is_mp4_container, parse_duration_ms, tag_args,
    };

    #[test]
    fn mp3_export_reencodes_and_m4a_copies() {
        let mp3 = export_args(ExportFormat::Mp3, true);
        assert!(mp3.windows(2).any(|w| w == ["-c:a", "libmp3lame"]));
        assert!(!mp3.contains(&"attached_pic"));
        let m4a = export_args(ExportFormat::M4a, false);
        assert!(m4a.windows(2).any(|w| w == ["-c:a", "copy"]));
        assert!(!m4a.contains(&"1:v"));
    }

    #[test]
    fn blank_tags_are_left_out() {
        let tags = ExportTags {
            title: Some("  Night Drive ".into()),
            artist: Some("   ".into()),
        };
        assert_eq!(tag_args(&tags), vec!["-metadata", "title=Night Drive"]);
        assert!(tag_args(&ExportTags::default()).is_empty());
    }

    #[test]
    fn detects_mp4_container() {
        assert!(is_mp4_container(b"\x00\x00\x00\x20ftypM4A "));
        assert!(!is_mp4_container(b"ID3\x04\x00\x00\x00\x00")); // mp3
        assert!(!is_mp4_container(b"OggS\x00\x02\x00\x00")); // opus/ogg
        assert!(!is_mp4_container(b"\xff\xf1\x50\x80")); // adts aac
    }

    #[test]
    fn parses_duration_line() {
        let s = "  Duration: 00:03:25.71, start: 0.000000, bitrate: 256 kb/s";
        assert_eq!(parse_duration_ms(s), Some(205_710));
        assert_eq!(parse_duration_ms("Duration: 01:00:00.00,"), Some(3_600_000));
        assert_eq!(parse_duration_ms("Duration: N/A, bitrate: N/A"), None);
        assert_eq!(parse_duration_ms("no duration here"), None);
    }
}

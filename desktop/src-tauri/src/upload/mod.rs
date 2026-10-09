mod progress;

use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use wreq::multipart::{Form, Part};

use crate::network::edge::{self, Hop, Tier};
use crate::network::system_proxy::follow;
use crate::rt::AppHandle;
use progress::Reporter;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const UPLOAD_TIMEOUT: Duration = Duration::from_secs(60 * 60);
const ARTWORK_MAX_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackUploadRequest {
    id: String,
    backend_url: String,
    session_id: String,
    file_path: String,
    artwork_path: Option<String>,
    fields: HashMap<String, String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadFailure {
    kind: &'static str,
    status: Option<u16>,
    code: Option<String>,
    message: Option<String>,
    retry_after: Option<u64>,
}

impl UploadFailure {
    fn of(kind: &'static str) -> Self {
        Self {
            kind,
            status: None,
            code: None,
            message: None,
            retry_after: None,
        }
    }

    fn file(code: &str) -> Self {
        Self {
            code: Some(code.to_owned()),
            ..Self::of("file")
        }
    }
}

struct Artwork {
    bytes: Vec<u8>,
    file_name: String,
    mime: &'static str,
}

fn running() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    static RUNNING: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();
    RUNNING.get_or_init(Default::default)
}

fn with_running<T>(f: impl FnOnce(&mut HashMap<String, Arc<AtomicBool>>) -> T) -> T {
    let mut guard = running()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    f(&mut guard)
}

#[tauri::command]
pub async fn track_upload_start(
    request: TrackUploadRequest,
    app: AppHandle,
) -> Result<Value, UploadFailure> {
    let cancel = Arc::new(AtomicBool::new(false));
    with_running(|uploads| uploads.insert(request.id.clone(), cancel.clone()));
    let result = upload(&request, app, cancel).await;
    with_running(|uploads| uploads.remove(&request.id));
    result
}

#[tauri::command]
pub fn track_upload_cancel(id: String) {
    with_running(|uploads| {
        if let Some(cancel) = uploads.get(&id) {
            cancel.store(true, Ordering::Relaxed);
        }
    });
}

async fn upload(
    request: &TrackUploadRequest,
    app: AppHandle,
    cancel: Arc<AtomicBool>,
) -> Result<Value, UploadFailure> {
    let path = Path::new(&request.file_path);
    let total = tokio::fs::metadata(path)
        .await
        .ok()
        .filter(|meta| meta.is_file() && meta.len() > 0)
        .map(|meta| meta.len())
        .ok_or_else(|| UploadFailure::file("audio_unreadable"))?;
    let file_name = file_name_of(path);
    let artwork = match request.artwork_path.as_deref() {
        Some(artwork) => Some(read_artwork(Path::new(artwork)).await?),
        None => None,
    };
    let reporter = Arc::new(Reporter::new(app, request.id.clone(), total, cancel.clone()));
    reporter.emit(0);

    let client = follow(wreq::Client::builder())
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(UPLOAD_TIMEOUT)
        .build()
        .map_err(|_| UploadFailure::of("network"))?;
    let url = format!("{}/tracks/upload", request.backend_url.trim_end_matches('/'));
    let mut hops = edge::upload_plan(&url);
    if hops.is_empty() {
        hops.push(Hop {
            url: url.clone(),
            tier: Tier::Direct,
            origin: String::new(),
        });
    }

    let mut last = UploadFailure::of("network");
    for hop in hops {
        let file = tokio::fs::File::open(path)
            .await
            .map_err(|_| UploadFailure::file("audio_unreadable"))?;
        let body = wreq::Body::wrap_stream(progress::file_stream(file, reporter.clone()));
        let form = form(request, artwork.as_ref(), body, total, &file_name)?;
        let sent = client
            .post(&hop.url)
            .header("x-session-id", &request.session_id)
            .multipart(form)
            .send()
            .await;
        let response = match sent {
            Ok(response) => response,
            Err(_) if cancel.load(Ordering::Relaxed) => return Err(UploadFailure::of("cancelled")),
            Err(error) if error.is_connect() => {
                hop.note(false);
                last = UploadFailure::of("network");
                continue;
            }
            Err(_) => return Err(UploadFailure::of("network")),
        };
        hop.note(true);
        return answer(response).await;
    }
    Err(last)
}

fn form(
    request: &TrackUploadRequest,
    artwork: Option<&Artwork>,
    body: wreq::Body,
    total: u64,
    file_name: &str,
) -> Result<Form, UploadFailure> {
    let mut form = Form::new();
    for (key, value) in &request.fields {
        form = form.text(key.clone(), value.clone());
    }
    if let Some(artwork) = artwork {
        let part = Part::bytes(artwork.bytes.clone())
            .file_name(artwork.file_name.clone())
            .mime_str(artwork.mime)
            .map_err(|_| UploadFailure::file("artwork_unsupported"))?;
        form = form.part("artwork", part);
    }
    Ok(form.part(
        "asset",
        Part::stream_with_length(body, total).file_name(file_name.to_owned()),
    ))
}

async fn answer(response: wreq::Response) -> Result<Value, UploadFailure> {
    let status = response.status();
    let retry_after = response
        .headers()
        .get(wreq::header::RETRY_AFTER)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.trim().parse().ok());
    let body: Value = response.json().await.unwrap_or(Value::Null);
    if status.is_success() {
        return Ok(body);
    }
    Err(UploadFailure {
        status: Some(status.as_u16()),
        code: body.get("code").and_then(Value::as_str).map(str::to_owned),
        message: server_message(&body),
        retry_after,
        ..UploadFailure::of("server")
    })
}

fn server_message(body: &Value) -> Option<String> {
    body.pointer("/errors/0/error_message")
        .or_else(|| body.get("message"))
        .and_then(Value::as_str)
        .map(str::to_owned)
}

async fn read_artwork(path: &Path) -> Result<Artwork, UploadFailure> {
    let mime = match extension_of(path).as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        _ => return Err(UploadFailure::file("artwork_unsupported")),
    };
    let meta = tokio::fs::metadata(path)
        .await
        .map_err(|_| UploadFailure::file("artwork_unreadable"))?;
    if meta.len() > ARTWORK_MAX_BYTES {
        return Err(UploadFailure::file("artwork_too_large"));
    }
    let bytes = tokio::fs::read(path)
        .await
        .map_err(|_| UploadFailure::file("artwork_unreadable"))?;
    Ok(Artwork {
        bytes,
        file_name: file_name_of(path),
        mime,
    })
}

fn extension_of(path: &Path) -> String {
    path.extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn file_name_of(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("track")
        .to_owned()
}

#[cfg(test)]
mod tests {
    use super::{extension_of, file_name_of, server_message};
    use serde_json::json;
    use std::path::Path;

    #[test]
    fn file_names_and_extensions_come_from_the_path() {
        let path = Path::new("music").join("Night Drive.FLAC");
        assert_eq!(file_name_of(&path), "Night Drive.FLAC");
        assert_eq!(extension_of(&path), "flac");
        assert_eq!(extension_of(Path::new("cover")), "");
    }

    #[test]
    fn soundcloud_rejections_keep_their_reason() {
        let soundcloud = json!({"errors": [{"error_message": "Upload limit reached"}]});
        assert_eq!(
            server_message(&soundcloud).as_deref(),
            Some("Upload limit reached")
        );
        let ours = json!({"code": "upload_too_large", "message": "Too large"});
        assert_eq!(server_message(&ours).as_deref(), Some("Too large"));
        assert_eq!(server_message(&json!(null)), None);
    }
}

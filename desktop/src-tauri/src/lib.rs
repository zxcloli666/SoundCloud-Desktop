use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::Manager;
use tokio::fs::File;
use tokio::io::AsyncReadExt;
use warp::http::{Response, StatusCode};
use warp::Filter;

use discord_rich_presence::{
    activity::{Activity, ActivityType, Assets, Button, Timestamps},
    DiscordIpc, DiscordIpcClient,
};

const DISCORD_CLIENT_ID: &str = "1431978756687265872";

struct CacheServerState {
    port: u16,
}

struct DiscordState {
    client: Mutex<Option<DiscordIpcClient>>,
}

#[tauri::command]
fn get_cache_server_port(state: tauri::State<'_, Arc<CacheServerState>>) -> u16 {
    state.port
}

#[tauri::command]
fn discord_connect(state: tauri::State<'_, Arc<DiscordState>>) -> Result<bool, String> {
    let mut guard = state.client.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Ok(true);
    }
    let mut client = DiscordIpcClient::new(DISCORD_CLIENT_ID);
    match client.connect() {
        Ok(_) => {
            println!("[Discord] Connected");
            *guard = Some(client);
            Ok(true)
        }
        Err(e) => {
            println!("[Discord] Connection failed: {e}");
            Err(format!("Connection failed: {e}"))
        }
    }
}

#[tauri::command]
fn discord_disconnect(state: tauri::State<'_, Arc<DiscordState>>) {
    let mut guard = state.client.lock().unwrap();
    if let Some(ref mut client) = *guard {
        let _ = client.close();
        println!("[Discord] Disconnected");
    }
    *guard = None;
}

#[derive(serde::Deserialize)]
pub struct DiscordTrackInfo {
    title: String,
    artist: String,
    artwork_url: Option<String>,
    track_url: Option<String>,
    duration_secs: Option<i64>,
    elapsed_secs: Option<i64>,
}

#[tauri::command]
fn discord_set_activity(
    state: tauri::State<'_, Arc<DiscordState>>,
    track: DiscordTrackInfo,
) -> Result<(), String> {
    let mut guard = state.client.lock().map_err(|e| e.to_string())?;
    let client = guard.as_mut().ok_or("Discord not connected")?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let elapsed = track.elapsed_secs.unwrap_or(0);
    let start = now - elapsed;

    let mut timestamps = Timestamps::new().start(start);
    if let Some(dur) = track.duration_secs {
        timestamps = timestamps.end(start + dur);
    }

    let large_image = track
        .artwork_url
        .as_deref()
        .unwrap_or("soundcloud_logo");

    let assets = Assets::new()
        .large_image(large_image)
        .large_text(&track.title);

    let mut activity = Activity::new()
        .activity_type(ActivityType::Listening)
        .details(&track.title)
        .state(&track.artist)
        .assets(assets)
        .timestamps(timestamps);

    if let Some(ref url) = track.track_url {
        activity = activity.buttons(vec![Button::new("Listen on SoundCloud", url)]);
    }

    client
        .set_activity(activity)
        .map_err(|e| format!("set_activity: {e}"))?;

    Ok(())
}

#[tauri::command]
fn discord_clear_activity(state: tauri::State<'_, Arc<DiscordState>>) -> Result<(), String> {
    let mut guard = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut client) = *guard {
        client
            .clear_activity()
            .map_err(|e| format!("clear_activity: {e}"))?;
    }
    Ok(())
}

// ── Cache Server ──────────────────────────────────────────────

async fn serve_audio(
    filename: String,
    cache_dir: PathBuf,
    range_header: Option<String>,
) -> Result<Response<Vec<u8>>, warp::Rejection> {
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Ok(Response::builder()
            .status(StatusCode::BAD_REQUEST)
            .body(Vec::new())
            .unwrap());
    }

    let path = cache_dir.join(&filename);
    let mut file = match File::open(&path).await {
        Ok(f) => f,
        Err(_) => {
            return Ok(Response::builder()
                .status(StatusCode::NOT_FOUND)
                .body(Vec::new())
                .unwrap());
        }
    };

    let metadata = file.metadata().await.unwrap();
    let total = metadata.len();

    if let Some(range) = range_header {
        if let Some(range_val) = range.strip_prefix("bytes=") {
            let parts: Vec<&str> = range_val.splitn(2, '-').collect();
            let start: u64 = parts[0].parse().unwrap_or(0);
            let end: u64 = if parts.len() > 1 && !parts[1].is_empty() {
                parts[1].parse().unwrap_or(total - 1)
            } else {
                total - 1
            };

            if start >= total {
                return Ok(Response::builder()
                    .status(StatusCode::RANGE_NOT_SATISFIABLE)
                    .header("Content-Range", format!("bytes */{total}"))
                    .body(Vec::new())
                    .unwrap());
            }

            let length = end - start + 1;
            let mut buf = vec![0u8; length as usize];
            tokio::io::AsyncSeekExt::seek(&mut file, std::io::SeekFrom::Start(start))
                .await
                .unwrap();
            file.read_exact(&mut buf).await.unwrap_or_default();

            return Ok(Response::builder()
                .status(StatusCode::PARTIAL_CONTENT)
                .header("Content-Type", "audio/mpeg")
                .header("Content-Length", length.to_string())
                .header("Content-Range", format!("bytes {start}-{end}/{total}"))
                .header("Accept-Ranges", "bytes")
                .header("Access-Control-Allow-Origin", "*")
                .body(buf)
                .unwrap());
        }
    }

    let mut buf = Vec::with_capacity(total as usize);
    file.read_to_end(&mut buf).await.unwrap_or_default();

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "audio/mpeg")
        .header("Content-Length", total.to_string())
        .header("Accept-Ranges", "bytes")
        .header("Access-Control-Allow-Origin", "*")
        .body(buf)
        .unwrap())
}

async fn start_cache_server(cache_dir: PathBuf) -> u16 {
    let dir = cache_dir.clone();

    let audio_route = warp::path("audio")
        .and(warp::path::param::<String>())
        .and(warp::path::end())
        .and(warp::header::optional::<String>("range"))
        .and_then(move |filename: String, range: Option<String>| {
            let dir = dir.clone();
            async move { serve_audio(filename, dir, range).await }
        });

    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "HEAD", "OPTIONS"])
        .allow_headers(vec!["range", "content-type"])
        .expose_headers(vec!["content-range", "content-length", "accept-ranges"]);

    let routes = audio_route.with(cors);

    let addr: SocketAddr = ([127, 0, 0, 1], 0).into();
    let (addr, server) = warp::serve(routes).bind_ephemeral(addr);

    tokio::spawn(server);

    println!(
        "[CacheServer] Listening on http://127.0.0.1:{}",
        addr.port()
    );
    addr.port()
}

// ── Tray ──────────────────────────────────────────────────────

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::Emitter;

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
    let play_pause = MenuItemBuilder::with_id("play_pause", "Play / Pause").build(app)?;
    let next = MenuItemBuilder::with_id("next", "Next").build(app)?;
    let prev = MenuItemBuilder::with_id("prev", "Previous").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&show, &play_pause, &prev, &next, &quit])
        .build()?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().expect("no app icon"))
        .tooltip("SoundCloud Desktop")
        .menu(&menu)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            match id {
                "show" => {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.unminimize();
                        let _ = w.set_focus();
                    }
                }
                "play_pause" | "next" | "prev" => {
                    let _ = app.emit("tray-action", id);
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                if let Some(w) = tray.app_handle().get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.unminimize();
                    let _ = w.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}


// ── App ───────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            let cache_dir = app
                .path()
                .app_cache_dir()
                .expect("failed to resolve app cache dir");

            let audio_dir = cache_dir.join("audio");
            std::fs::create_dir_all(&audio_dir).ok();

            let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
            let port = rt.block_on(start_cache_server(audio_dir.clone()));

            std::thread::spawn(move || {
                rt.block_on(std::future::pending::<()>());
            });

            app.manage(Arc::new(CacheServerState { port }));
            app.manage(Arc::new(DiscordState {
                client: Mutex::new(None),
            }));

            setup_tray(app).expect("failed to setup tray");

            Ok(())
        })
        .on_window_event(|window, event| {
                     if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                         api.prevent_close();
                         let _ = window.hide();
                     }
        })
        .invoke_handler(tauri::generate_handler![
            get_cache_server_port,
            discord_connect,
            discord_disconnect,
            discord_set_activity,
            discord_clear_activity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

mod app;
mod audio;
mod auth;
mod discord;
mod import;
mod network;
mod rt;
mod shared;
mod track_cache;

use std::sync::Arc;
use std::time::Duration;
use tauri::Manager;

use discord::DiscordState;
use network::server::ServerState;

const HTTP_CONNECT_TIMEOUT_SECS: u64 = 8;
const HTTP_READ_TIMEOUT_SECS: u64 = 30;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg_attr(feature = "cef", tauri::cef_entry_point)]
pub fn run() {
    #[cfg(all(windows, not(feature = "cef")))]
    app::webview2::exit_if_runtime_missing();

    let builder = tauri::Builder::<rt::Rt>::new();

    builder
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            app::visibility::show_main(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .register_asynchronous_uri_scheme_protocol("scproxy", |_ctx, request, responder| {
            let Some(state) = network::proxy::STATE.get() else {
                responder.respond(
                    http::Response::builder()
                        .status(503)
                        .body(b"not ready".to_vec())
                        .unwrap(),
                );
                return;
            };
            state.rt_handle.spawn(async move {
                responder.respond(network::proxy::handle_uri(request).await);
            });
        })
        .setup(move |app| {
            app::diagnostics::install_panic_hook(app.handle());
            #[cfg(all(windows, not(feature = "cef")))]
            app::webview2::exit_if_main_window_missing(app);

            let cache_dir = app
                .path()
                .app_cache_dir()
                .expect("failed to resolve app cache dir");
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");

            let storage = Arc::new(app::storage::StorageLocation::init(&cache_dir, &data_dir));
            let audio_dirs = storage.audio_dirs();

            let assets_dir = cache_dir.join("assets");
            std::fs::create_dir_all(&assets_dir).ok();

            let wallpapers_dir = cache_dir.join("wallpapers");
            std::fs::create_dir_all(&wallpapers_dir).ok();

            let images_dir = data_dir.join("images");
            std::fs::create_dir_all(&images_dir).ok();

            network::edge::init(data_dir.clone());

            let http_client = network::system_proxy::follow(sc_fingerprint::builder(None))
                .connect_timeout(Duration::from_secs(HTTP_CONNECT_TIMEOUT_SECS))
                .read_timeout(Duration::from_secs(HTTP_READ_TIMEOUT_SECS))
                .build()
                .expect("failed to build HTTP client");
            let auth_http_client = http_client.clone();
            let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");

            network::proxy::STATE
                .set(network::proxy::State {
                    assets_dir,
                    http_client: http_client.clone(),
                    rt_handle: rt.handle().clone(),
                })
                .ok();

            network::image_cache::STATE
                .set(network::image_cache::ImageCache {
                    dir: images_dir,
                    http_client,
                })
                .ok();

            let (static_port, proxy_port) = rt.block_on(network::server::start_all(wallpapers_dir));
            let rt_handle = rt.handle().clone();

            std::thread::spawn(move || {
                rt.block_on(std::future::pending::<()>());
            });

            app.manage(Arc::new(ServerState {
                static_port,
                proxy_port,
            }));
            app::diagnostics::mark_session_started(app.handle());
            app::diagnostics::log_linux_render_env(app.handle());
            app::diagnostics::start_linux_fd_monitor(app.handle());
            network::health::start(data_dir.clone(), app.handle().clone(), rt_handle.clone());
            app.manage(Arc::new(DiscordState::default()));

            let ffmpeg_dir = cache_dir.join("ffmpeg");
            std::fs::create_dir_all(&ffmpeg_dir).ok();

            let mut track_cache_state =
                track_cache::init(audio_dirs.audio, audio_dirs.liked, audio_dirs.incoming);
            track_cache_state.set_app_handle(app.handle().clone());
            let recovery_state = track_cache_state.clone();
            app.manage(track_cache_state);
            let sweeper = storage.clone();
            std::thread::spawn(move || sweeper.sweep_stale_roots());
            app.manage(storage);
            // Acquire ffmpeg (system PATH or one-time download) in the background,
            // then sweep interrupted temps and resume transcoding raw files left
            // by a previous crash/close.
            rt_handle.spawn(async move {
                recovery_state.init_ffmpeg(ffmpeg_dir).await;
                recovery_state.recover_incoming().await;
            });

            let audio_state = audio::init(app.handle());
            let analyser_buffer = audio_state.analyser_buffer.clone();
            app.manage(audio_state);
            audio::start_tick_emitter(app.handle());
            audio::start_media_controls(app.handle());
            audio::start_default_output_monitor(app.handle());
            audio::start_fft_thread(app.handle().clone(), analyser_buffer);

            app.manage(app::popover::TrayState::default());
            app::tray::setup_tray(app).expect("failed to setup tray");

            let auth_state =
                auth::SessionStore::init(data_dir.clone(), auth_http_client, rt_handle.clone());
            app.manage(auth_state);

            let call_state = network::call::CallState::init(data_dir.clone(), rt_handle);
            network::call::manage_state(app.handle(), call_state.clone());
            network::call::maybe_autostart(app.handle(), call_state);

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" && !app::tray::is_available() {
                    app::tray::run_action(window.app_handle(), "quit");
                } else {
                    api.prevent_close();
                    let _ = window.hide();
                    app::visibility::set_window_page_visible(window, false);
                }
            }
            // Transient popover (tray left-click) dismisses on blur; a pinned one
            // (opened from the "Mini player" menu) stays put — closed only by its ✕.
            tauri::WindowEvent::Focused(false)
            if window.label() == app::popover::LABEL =>
                {
                    let st = window.app_handle().state::<app::popover::TrayState>();
                    if !st.is_pinned() {
                        let _ = window.hide();
                        app::visibility::set_window_page_visible(window, false);
                        st.mark_hidden();
                    }
                }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            network::server::get_server_ports,
            app::diagnostics::diagnostics_log,
            app::visibility::show_main_window,
            app::popover::tray_popover_hide,
            app::storage::storage_location_info,
            app::storage::storage_relocate,
            app::storage::storage_open_folder,
            app::storage::app_restart,
            discord::discord_connect,
            discord::discord_disconnect,
            discord::discord_set_activity,
            discord::discord_clear_activity,
            audio::audio_load_file,
            audio::audio_load_url,
            audio::audio_play,
            audio::audio_pause,
            audio::audio_stop,
            audio::audio_seek,
            audio::audio_set_volume,
            audio::audio_set_playback_rate,
            audio::audio_set_pitch_ratio,
            audio::audio_set_ab_loop,
            audio::audio_get_position,
            audio::audio_set_eq,
            audio::audio_set_normalization,
            audio::audio_is_playing,
            audio::audio_set_metadata,
            audio::audio_set_playback_state,
            audio::audio_set_media_position,
            audio::audio_list_devices,
            audio::audio_switch_device,
            audio::audio_set_follow_default_output,
            audio::audio_set_lyrics_timeline,
            audio::audio_clear_lyrics_timeline,
            audio::audio_set_comments_timeline,
            audio::audio_clear_comments_timeline,
            audio::audio_preview_play,
            audio::audio_preview_stop,
            audio::save_track_to_path,
            import::ym_import_start,
            import::ym_import_stop,
            track_cache::track_ensure_cached,
            track_cache::track_export,
            track_cache::track_export_to_dir,
            track_cache::track_export_mp3_supported,
            track_cache::track_save_offline,
            track_cache::track_is_cached,
            track_cache::track_transcode_status,
            track_cache::track_get_cache_path,
            track_cache::track_get_cache_info,
            track_cache::track_preload,
            track_cache::track_cache_size,
            track_cache::track_liked_cache_size,
            track_cache::track_clear_cache,
            track_cache::track_clear_liked_cache,
            track_cache::track_remove_cached,
            track_cache::track_list_cached,
            track_cache::track_cache_inventory,
            track_cache::track_enforce_cache_limit,
            track_cache::track_purge_played,
            track_cache::track_bulk_cache_start,
            track_cache::track_bulk_cache_status,
            track_cache::track_bulk_cache_cancel,
            network::image_cache::maintenance::image_cache_size,
            network::image_cache::maintenance::image_cache_clear,
            network::image_cache::maintenance::image_cache_enforce_limit,
            network::call::call_set_enabled,
            network::call::call_is_enabled,
            network::call::call_status,
            auth::auth_status,
            auth::auth_set_session,
            auth::auth_logout,
            auth::auth_set_premium,
            network::edge::edge_config,
            network::edge::edge_note,
            network::wallpapers::wallpaper_search,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

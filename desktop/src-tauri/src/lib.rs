mod app;
mod audio;
mod auth;
mod chat;
mod diag;
mod discord;
mod import;
mod local_library;
mod network;
mod obs;
mod rt;
mod scrobble;
mod shared;
mod track_cache;
mod upload;

use std::sync::Arc;
use std::time::Duration;
use tauri::{Emitter, Manager};

use discord::DiscordState;
use network::server::ServerState;
use obs::ObsState;
use scrobble::ScrobbleState;

const HTTP_CONNECT_TIMEOUT_SECS: u64 = 8;
const HTTP_READ_TIMEOUT_SECS: u64 = 30;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    app::diagnostics::init_log_file();
    app::diagnostics::install_panic_hook();
    let _ = rustls::crypto::ring::default_provider().install_default();
    app::render_mode::apply_before_launch();
    app::webview_data::wipe_before_launch();
    #[cfg(windows)]
    app::webview2::exit_if_runtime_missing();

    let builder = tauri::Builder::<rt::Rt>::new();

    builder
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if app::launch_flags::has_no_custom_css(&args) {
                let _ = app.emit_to("main", "safe-mode", ());
            }
            if !app::autostart::is_login_launch(&args) {
                app::visibility::show_main(app);
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(app::hotkeys::plugin())
        .plugin(app::navigation::plugin())
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
        .register_asynchronous_uri_scheme_protocol(
            chat::media_scheme::SCHEME,
            |ctx, request, responder| {
                let app = ctx.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    responder.respond(chat::media_scheme::handle(&app, request).await);
                });
            },
        )
        .setup(move |app| {
            #[cfg(windows)]
            app::webview2::exit_if_main_window_missing(app);
            app::autostart::reveal_main_window(app);
            app::autostart::refresh_entry(app);
            app::updater::register(app);

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

            let local_covers_dir = local_library::covers_dir(&data_dir);
            std::fs::create_dir_all(&local_covers_dir).ok();

            let css_assets_dir = data_dir.join("css-assets");
            std::fs::create_dir_all(&css_assets_dir).ok();

            let theme_files_dir = app::themes::files_dir(&data_dir);
            std::fs::create_dir_all(&theme_files_dir).ok();

            let images_dir = data_dir.join("images");
            std::fs::create_dir_all(&images_dir).ok();

            network::edge::init(data_dir.clone());
            network::edge::attach(app.handle().clone());

            let (_, emulation) = sc_fingerprint::emulation(None);
            let pinging = network::fetch::pinging(emulation, network::pace::Pace::Patient);
            let builder = sc_fingerprint::from_emulation(pinging);
            let http_client = network::system_proxy::follow(builder)
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

            let (static_port, proxy_port) = rt.block_on(network::server::start_all(
                wallpapers_dir,
                local_covers_dir,
                css_assets_dir,
                theme_files_dir,
            ));
            let rt_handle = rt.handle().clone();
            network::dns::init(rt_handle.clone());
            network::netcheck::init(app.handle().clone(), rt_handle.clone(), data_dir.clone());
            diag::start::run(
                &data_dir,
                env!("CARGO_PKG_VERSION"),
                app::updater::install_label(),
            );

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
            app.manage(Arc::new(ObsState::default()));

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
            app::visibility::start_watch(app.handle());
            audio::start_tick_emitter(app.handle());
            audio::start_media_controls(app.handle());
            audio::start_default_output_monitor(app.handle());
            audio::start_fft_thread(app.handle().clone(), analyser_buffer);

            app.manage(app::popover::TrayState::load(&data_dir));
            app::tray::setup_tray(app).expect("failed to setup tray");

            app.manage(ScrobbleState::init(
                data_dir.clone(),
                auth_http_client.clone(),
                app.handle().clone(),
                &rt_handle,
            ));

            let auth_state =
                auth::SessionStore::init(data_dir.clone(), auth_http_client, rt_handle.clone());
            app.state::<audio::AudioState>()
                .effects
                .set_premium(auth_state.premium_at_start());
            app.manage(auth_state);

            chat::start(app.handle(), rt_handle.clone(), &data_dir);

            let call_state = network::call::CallState::init(data_dir.clone(), rt_handle);
            network::call::manage_state(app.handle(), call_state.clone());
            network::call::maybe_autostart(app.handle(), call_state);

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" && app::close_action::quits_on_close() {
                    app::tray::run_action(window.app_handle(), "quit");
                } else {
                    api.prevent_close();
                    let _ = window.hide();
                    app::visibility::set_window_page_visible(window, false);
                }
            }
            tauri::WindowEvent::Moved(position) if window.label() == app::popover::LABEL => {
                window
                    .app_handle()
                    .state::<app::popover::TrayState>()
                    .record_move(position.x, position.y);
            }
            tauri::WindowEvent::Resized(size) if window.label() == "main" => {
                app::visibility::follow_minimize(window, size);
            }
            tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) => {
                chat::upload::dropped(window.app_handle(), paths);
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
            app::diagnostics::diagnostics_log_dir,
            app::diagnostics::diagnostics_open_log_dir,
            app::close_action::close_action_get,
            app::close_action::close_action_set,
            app::autostart::autostart_get,
            app::autostart::autostart_set_enabled,
            app::autostart::autostart_set_minimized,
            app::render_mode::render_mode_get,
            app::render_mode::render_mode_set,
            app::render_mode::render_mode_restart,
            app::hotkeys::hotkeys_apply,
            app::hotkeys::hotkeys_backend,
            app::updater::updater_info,
            app::updater::updater_install,
            app::diagnostics::diagnostics_reveal_log,
            app::launch_flags::custom_css_suppressed,
            app::themes::theme_file_store,
            app::themes::theme_files_gc,
            app::themes::theme_alive,
            app::visibility::show_main_window,
            app::popover::tray_popover_hide,
            app::tray_labels::tray_set_labels,
            app::storage::storage_location_info,
            app::storage::storage_relocate,
            app::storage::storage_open_folder,
            app::storage::app_restart,
            discord::discord_connect,
            discord::discord_disconnect,
            discord::discord_set_activity,
            discord::discord_clear_activity,
            obs::obs_configure,
            obs::obs_update,
            obs::obs_status,
            scrobble::scrobble_status,
            scrobble::scrobble_refresh,
            scrobble::scrobble_disconnect,
            scrobble::scrobble_now_playing,
            scrobble::scrobble_submit,
            scrobble::lastfm_auth_start,
            scrobble::lastfm_auth_finish,
            scrobble::lastfm_auth_cancel,
            scrobble::listenbrainz_connect,
            audio::audio_load_file,
            audio::audio_load_url,
            audio::audio_play,
            audio::audio_pause,
            audio::audio_stop,
            audio::audio_seek,
            audio::audio_set_volume,
            audio::audio_set_playback_rate,
            audio::audio_set_fft_enabled,
            audio::audio_set_pitch_ratio,
            audio::audio_set_effects,
            audio::audio_set_ab_loop,
            audio::audio_set_skip_silence,
            audio::audio_get_position,
            audio::audio_set_eq,
            audio::audio_eq_auto_preamp,
            audio::audio_eq_import,
            audio::audio_eq_import_file,
            audio::audio_eq_export,
            audio::audio_eq_save,
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
            import::import_start,
            import::import_stop,
            import::import_detect,
            import::import_ym_library,
            import::import_read_list_file,
            import::import_notify,
            import::import_sync_pull,
            import::import_syncable,
            import::import_sync_load,
            import::import_sync_store,
            local_library::local_library_scan,
            local_library::local_library_missing,
            local_library::local_library_forget,
            upload::track_upload_start,
            upload::track_upload_cancel,
            track_cache::track_ensure_cached,
            track_cache::track_upgrade_cached,
            track_cache::track_export,
            track_cache::track_export_to_dir,
            track_cache::track_export_mp3_supported,
            track_cache::track_save_offline,
            track_cache::track_is_cached,
            track_cache::track_transcode_status,
            track_cache::track_get_cache_path,
            track_cache::track_get_cache_info,
            track_cache::track_pinned_urns,
            track_cache::track_mark_played,
            track_cache::track_preload,
            track_cache::track_cache_size,
            track_cache::track_liked_cache_size,
            track_cache::track_clear_cache,
            track_cache::track_clear_liked_cache,
            track_cache::track_remove_cached,
            track_cache::track_demote_liked,
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
            network::call::call_device_id,
            network::call::call_status,
            auth::auth_status,
            auth::auth_set_session,
            auth::auth_logout,
            auth::auth_set_premium,
            network::edge::edge_config,
            network::edge::edge_note,
            network::fetch::net_fetch,
            network::fetch::net_fetch_cancel,
            diag::commands::diag_error,
            diag::commands::diag_bundle,
            diag::commands::diag_queue_batch,
            diag::commands::diag_queue_settle,
            diag::commands::diag_save_file,
            diag::commands::diag_session,
            diag::commands::diag_set_reporting,
            network::netcheck::net_check_run,
            network::netcheck::net_status_verdict,
            network::netcheck::net_check_auto,
            network::netcheck::net_check_last,
            network::netcheck::net_check_report_text,
            network::wallpapers::wallpaper_search,
            app::desktop_wallpaper::desktop_wallpaper_found,
            app::desktop_wallpaper::desktop_wallpaper_sync,
            chat::commands::chat_status,
            chat::commands::chat_config,
            chat::commands::chat_login_begin,
            chat::commands::chat_login_poll,
            chat::commands::chat_link_create_pull,
            chat::commands::chat_link_claim_push,
            chat::commands::chat_link_poll,
            chat::commands::chat_list,
            chat::commands::chat_open,
            chat::commands::chat_history,
            chat::commands::chat_create,
            chat::commands::chat_conversation_update,
            chat::commands::chat_conversation_delete,
            chat::commands::chat_set_ttl,
            chat::commands::chat_send,
            chat::commands::chat_edit,
            chat::commands::chat_delete,
            chat::commands::chat_react,
            chat::commands::chat_pin,
            chat::commands::chat_mark_read,
            chat::commands::chat_typing,
            chat::commands::chat_focus,
            chat::commands::chat_draft_save,
            chat::commands::chat_search,
            chat::commands::chat_members,
            chat::commands::chat_member_add,
            chat::commands::chat_member_remove,
            chat::commands::chat_member_role,
            chat::commands::chat_accept,
            chat::commands::chat_decline,
            chat::commands::chat_requests,
            chat::commands::chat_invite_create,
            chat::commands::chat_invite_revoke,
            chat::commands::chat_invite_join,
            chat::commands::chat_block,
            chat::commands::chat_unblock,
            chat::commands::chat_report,
            chat::commands::chat_settings_get,
            chat::commands::chat_settings_put,
            chat::commands::chat_user_card,
            chat::commands::chat_devices,
            chat::commands::chat_device_confirm,
            chat::commands::chat_device_not_me,
            chat::commands::chat_device_remove,
            chat::commands::chat_room_chat,
            chat::commands::chat_room_preview,
            chat::commands::chat_room_moderate,
            chat::commands::chat_room_settings,
            chat::commands::chat_room_suggest,
            chat::commands::chat_logout,
            chat::commands::chat_notify_prefs,
            chat::commands::chat_embeds,
            chat::commands::chat_media_usage,
            chat::commands::chat_media_mine,
            chat::commands::chat_media_delete,
            chat::commands::chat_media_restore,
            chat::commands::chat_media_urls,
            chat::commands::chat_media_attach,
            chat::commands::chat_media_attach_data,
            chat::commands::chat_media_send,
            chat::commands::chat_media_album_cancel,
            chat::commands::chat_media_avatar,
            chat::commands::chat_room_backdrop,
            chat::commands::chat_room_backdrop_upload,
            chat::commands::chat_room_backdrop_report,
            chat::commands::chat_media_uploads,
            chat::commands::chat_media_parked,
            chat::commands::chat_media_upload_retry,
            chat::commands::chat_media_upload_cancel,
            chat::commands::chat_media_cache_size,
            chat::commands::chat_media_cache_clear,
            chat::login::chat_link_create_push,
            chat::login::chat_link_claim_pull,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| match event {
            tauri::RunEvent::Exit => app::themes::clear_applying(app),
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen { .. } => app::visibility::show_main(app),
            _ => {}
        });
}

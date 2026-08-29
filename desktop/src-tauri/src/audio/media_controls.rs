use std::time::Duration;

use souvlaki::{
    MediaControlEvent, MediaControls, MediaMetadata as SmtcMetadata, MediaPlayback, MediaPosition,
    PlatformConfig,
};
use crate::rt::AppHandle;
use tauri::{Emitter, Manager};

use crate::audio::state::AudioState;
use crate::audio::types::MediaCmd;

pub fn start_media_controls(app: &AppHandle) {
    let handle = app.clone();
    let (tx, rx) = std::sync::mpsc::channel::<MediaCmd>();

    let state = app.state::<AudioState>();
    *state.media_tx.lock().unwrap() = Some(tx);

    std::thread::Builder::new()
        .name("media-controls".into())
        .spawn(move || {
            #[cfg(not(target_os = "windows"))]
            let hwnd = None;

            #[cfg(target_os = "windows")]
            let hwnd = {
                handle.get_webview_window("main").and_then(|window| {
                    use raw_window_handle::HasWindowHandle;

                    window
                        .window_handle()
                        .ok()
                        .and_then(|handle| match handle.as_raw() {
                            raw_window_handle::RawWindowHandle::Win32(handle) => {
                                Some(handle.hwnd.get() as *mut std::ffi::c_void)
                            }
                            _ => None,
                        })
                })
            };

            let config = PlatformConfig {
                display_name: "Sonveil",
                dbus_name: "soundcloud_desktop",
                hwnd,
            };

            let mut controls = match MediaControls::new(config) {
                Ok(controls) => controls,
                Err(error) => {
                    eprintln!("[MediaControls] Failed to create: {:?}", error);
                    return;
                }
            };

            let event_handle = handle.clone();
            controls
                .attach(move |event: MediaControlEvent| match event {
                    MediaControlEvent::Play => {
                        event_handle.emit("media:play", ()).ok();
                    }
                    MediaControlEvent::Pause => {
                        event_handle.emit("media:pause", ()).ok();
                    }
                    MediaControlEvent::Toggle => {
                        event_handle.emit("media:toggle", ()).ok();
                    }
                    MediaControlEvent::Next => {
                        event_handle.emit("media:next", ()).ok();
                    }
                    MediaControlEvent::Previous => {
                        event_handle.emit("media:prev", ()).ok();
                    }
                    MediaControlEvent::SetPosition(MediaPosition(pos)) => {
                        event_handle.emit("media:seek", pos.as_secs_f64()).ok();
                    }
                    MediaControlEvent::Seek(dir) => {
                        let offset = match dir {
                            souvlaki::SeekDirection::Forward => 10.0,
                            souvlaki::SeekDirection::Backward => -10.0,
                        };
                        event_handle.emit("media:seek-relative", offset).ok();
                    }
                    _ => {}
                })
                .ok();

            loop {
                match rx.recv() {
                    Ok(MediaCmd::SetMetadata {
                        title,
                        artist,
                        cover_url,
                        duration_secs,
                    }) => {
                        controls
                            .set_metadata(SmtcMetadata {
                                title: Some(&title),
                                artist: Some(&artist),
                                cover_url: cover_url.as_deref(),
                                duration: if duration_secs > 0.0 {
                                    Some(Duration::from_secs_f64(duration_secs))
                                } else {
                                    None
                                },
                                ..Default::default()
                            })
                            .ok();
                    }
                    Ok(MediaCmd::SetPlaying(playing)) => {
                        let state = handle.state::<AudioState>();
                        // get_pos() is output time; the OS expects source-timeline position.
                        let pos = state
                            .player
                            .lock()
                            .unwrap()
                            .as_ref()
                            .map(|player| {
                                Duration::from_secs_f64(crate::audio::engine::source_pos(
                                    &state, player,
                                ))
                            })
                            .unwrap_or_default();
                        let progress = Some(MediaPosition(pos));
                        let playback = if playing {
                            MediaPlayback::Playing { progress }
                        } else {
                            MediaPlayback::Paused { progress }
                        };
                        controls.set_playback(playback).ok();
                    }
                    Ok(MediaCmd::SetPosition(secs)) => {
                        let state = handle.state::<AudioState>();
                        let is_playing = state
                            .player
                            .lock()
                            .unwrap()
                            .as_ref()
                            .map(|player| !player.is_paused() && !player.empty())
                            .unwrap_or(false);
                        let progress = Some(MediaPosition(Duration::from_secs_f64(secs)));
                        let playback = if is_playing {
                            MediaPlayback::Playing { progress }
                        } else {
                            MediaPlayback::Paused { progress }
                        };
                        controls.set_playback(playback).ok();
                    }
                    Err(_) => break,
                }
            }
        })
        .expect("failed to spawn media-controls thread");
}

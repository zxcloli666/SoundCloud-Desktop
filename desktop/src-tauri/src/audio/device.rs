use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use rodio::stream::{DeviceSinkBuilder, DeviceSinkError, MixerDeviceSink};
use crate::rt::AppHandle;
use tauri::{Emitter, Manager, State};

use crate::app::diagnostics;
use crate::audio::engine;
use crate::audio::state::AudioState;
use crate::audio::types::{AudioSink, AudioThreadCmd};

#[cfg(target_os = "linux")]
const LINUX_BUFFER_FRAMES: u32 = 4096;

pub fn open_device_sink(
    device_id: Option<&str>,
    reconnect_tx: &std::sync::mpsc::Sender<AudioThreadCmd>,
    error_flag: &Arc<AtomicBool>,
) -> Result<MixerDeviceSink, String> {
    use cpal::traits::{DeviceTrait, HostTrait};

    let sent = Arc::new(AtomicBool::new(false));
    let sent_clone = sent.clone();
    let tx = reconnect_tx.clone();
    let err_flag = error_flag.clone();
    let error_cb = move |err: cpal::StreamError| {
        eprintln!("[audio] stream error: {err}");
        if err == cpal::StreamError::BufferUnderrun {
            return;
        }
        err_flag.store(true, Ordering::Relaxed);
        if !sent_clone.swap(true, Ordering::Relaxed) {
            tx.send(AudioThreadCmd::Reconnect).ok();
        }
    };

    if let Some(id) = device_id {
        let host = cpal::default_host();
        if let Ok(devices) = host.output_devices() {
            for dev in devices {
                if dev.id().ok().map(|d| d.to_string()).as_deref() == Some(id) {
                    let mut sink = open_sink(dev, error_cb)
                        .map_err(|e| format!("Failed to open device '{}': {}", id, e))?;
                    sink.log_on_drop(false);
                    return Ok(sink);
                }
            }
        }
        return Err(format!("Device '{}' not found", id));
    }

    let opened = cpal::default_host()
        .default_output_device()
        .ok_or(DeviceSinkError::NoDevice)
        .and_then(|device| open_sink(device, error_cb.clone()));
    #[cfg(target_os = "linux")]
    let opened = opened.or_else(|error| open_sound_server_sink(error_cb).ok_or(error));
    let mut sink = opened.map_err(|e| format!("No audio output: {}", e))?;
    sink.log_on_drop(false);
    Ok(sink)
}

#[cfg(target_os = "linux")]
fn open_sound_server_sink<E>(error_cb: E) -> Option<MixerDeviceSink>
where
    E: FnMut(cpal::StreamError) + Send + Clone + 'static,
{
    use cpal::traits::{DeviceTrait, HostTrait};

    cpal::default_host()
        .output_devices()
        .ok()?
        .filter(|dev| {
            dev.description()
                .is_ok_and(|desc| matches!(desc.driver(), Some("pipewire" | "pulse")))
        })
        .find_map(|dev| open_sink(dev, error_cb.clone()).ok())
}

fn open_sink<E>(device: cpal::Device, error_cb: E) -> Result<MixerDeviceSink, DeviceSinkError>
where
    E: FnMut(cpal::StreamError) + Send + Clone + 'static,
{
    if let Some(builder) = tuned_builder(&device)
        && let Ok(sink) = builder.with_error_callback(error_cb.clone()).open_stream()
    {
        return Ok(sink);
    }
    DeviceSinkBuilder::from_device(device)?
        .with_error_callback(error_cb)
        .open_stream()
}

#[cfg(target_os = "linux")]
fn tuned_builder(device: &cpal::Device) -> Option<DeviceSinkBuilder> {
    let builder = DeviceSinkBuilder::from_device(device.clone()).ok()?;
    Some(builder.with_buffer_size(cpal::BufferSize::Fixed(LINUX_BUFFER_FRAMES)))
}

#[cfg(windows)]
fn tuned_builder(device: &cpal::Device) -> Option<DeviceSinkBuilder> {
    use cpal::traits::DeviceTrait;

    if device.default_output_config().ok()?.channels() <= 2 {
        return None;
    }
    let builder = DeviceSinkBuilder::from_device(device.clone()).ok()?;
    Some(builder.with_channels(rodio::nz!(2)))
}

#[cfg(not(any(target_os = "linux", windows)))]
fn tuned_builder(_device: &cpal::Device) -> Option<DeviceSinkBuilder> {
    None
}

pub fn list_devices() -> Vec<AudioSink> {
    #[cfg(target_os = "linux")]
    {
        audio_list_devices_pactl()
    }
    #[cfg(not(target_os = "linux"))]
    {
        audio_list_devices_cpal()
    }
}

/// Point the OS default at `device_name` and return the cpal device id the output
/// thread should open. On Linux routing is done with `pactl set-default-sink` and the
/// thread always opens the default cpal device, so the returned id is `None`; other
/// platforms open the device by id directly.
fn resolve_switch_name(device_name: &Option<String>) -> Result<Option<String>, String> {
    #[cfg(target_os = "linux")]
    {
        if let Some(name) = device_name {
            std::process::Command::new("pactl")
                .args(["set-default-sink", name])
                .status()
                .map_err(|e| format!("pactl failed: {}", e))?;
        }
        Ok(None)
    }
    #[cfg(not(target_os = "linux"))]
    {
        Ok(device_name.clone())
    }
}

/// Swap the active output sink and continue the current track on it — same source
/// position, same play/pause state, no gap in the queue. The live player is kept in
/// place: the output thread silences it by dropping the old sink while
/// `reload_current_track` reads its frozen position, builds a fresh player on the new
/// mixer, seeks, and atomically swaps. `reload_current_track` early-returns on a `None`
/// player, so the player must NOT be torn down before calling it (this mirrors the
/// device-reconnect path in tick.rs, which preserves the track for the same reason).
fn swap_device_and_continue(
    state: &AudioState,
    switch_name: Option<String>,
) -> Result<(), String> {
    // The old player freezes the instant the output thread drops its sink and the new
    // device may lag before it starts pulling samples; hold off stall-detection so the
    // tick thread doesn't fire a redundant reconnect during the swap.
    engine::suppress_stall_temporarily(state);

    let (reply_tx, reply_rx) = std::sync::mpsc::channel();
    state
        .audio_tx
        .send(AudioThreadCmd::SwitchDevice {
            name: switch_name,
            reply: reply_tx,
        })
        .map_err(|e| e.to_string())?;

    // The output thread updates the shared mixer (the same `Arc` as `state.mixer`) in
    // place before replying, falling back to the default device on failure. The mixer
    // is live either way, so rebuild the track on it, then surface any open error.
    let opened = reply_rx
        .recv()
        .map_err(|e| format!("Device switch failed: {}", e))?;
    engine::reload_current_track(state)?;
    opened.map(|_| ())
}

pub fn switch_device(
    state: State<'_, AudioState>,
    device_name: Option<String>,
) -> Result<(), String> {
    let preserved_default_name = if device_name.is_none() {
        current_default_output_name()
    } else {
        None
    };

    let switch_name = resolve_switch_name(&device_name)?;
    swap_device_and_continue(&state, switch_name)?;

    // Pin the resolved default as the known baseline so the follow monitor treats it
    // as already-applied instead of a fresh change to chase.
    if let Some(name) = preserved_default_name {
        *state.last_known_default_output.lock().unwrap() = Some(name);
    }
    Ok(())
}

pub fn set_follow_default_output(state: State<'_, AudioState>, follow: bool) {
    state.follow_default_output.store(follow, Ordering::Relaxed);
    if follow {
        *state.last_known_default_output.lock().unwrap() = current_default_output_name();
    }
}

pub fn start_default_output_monitor(app: &AppHandle) {
    let handle = app.clone();
    {
        let state = handle.state::<AudioState>();
        *state.last_known_default_output.lock().unwrap() = current_default_output_name();
    }

    std::thread::Builder::new()
        .name("audio-default-output".into())
        .spawn(move || {
            #[cfg(target_os = "linux")]
            start_pactl_subscribe_loop(&handle);

            #[cfg(not(target_os = "linux"))]
            start_polling_loop(&handle);
        })
        .expect("failed to spawn default-output monitor");
}

#[cfg(target_os = "linux")]
fn start_pactl_subscribe_loop(handle: &AppHandle) {
    use std::io::BufRead;

    loop {
        // Use pactl subscribe for instant sink change notifications
        let child = std::process::Command::new("pactl")
            .args(["subscribe"])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .spawn();

        let Ok(mut child) = child else {
            // Fallback to polling if pactl subscribe fails
            eprintln!("[Audio] pactl subscribe failed, falling back to polling");
            start_polling_loop(handle);
            return;
        };

        let stdout = child.stdout.take().unwrap();
        let reader = std::io::BufReader::new(stdout);

        for line in reader.lines() {
            let Ok(line) = line else { break };
            // Listen for sink changes: "Event 'change' on sink #..."
            // and server changes (default sink changed): "Event 'change' on server"
            if !line.contains("sink") && !line.contains("server") {
                continue;
            }

            handle_default_output_change(handle);
        }

        // pactl subscribe exited, wait and retry
        let _ = child.wait();
        std::thread::sleep(Duration::from_secs(2));
    }
}

fn start_polling_loop(handle: &AppHandle) {
    loop {
        std::thread::sleep(Duration::from_secs(2));
        handle_default_output_change(handle);
    }
}

fn handle_default_output_change(handle: &AppHandle) {
    let state = handle.state::<AudioState>();
    if !state.follow_default_output.load(Ordering::Relaxed) {
        return;
    }

    let Some(current_default) = current_default_output_name() else {
        return;
    };

    let mut known_default = state.last_known_default_output.lock().unwrap();
    if known_default.as_deref() == Some(current_default.as_str()) {
        return;
    }
    *known_default = Some(current_default.clone());
    drop(known_default);

    diagnostics::log_native(
        handle,
        "INFO",
        format!("[Audio] Default output changed to '{current_default}'"),
    );

    if let Err(error) = switch_to_device_internal(&state, None) {
        diagnostics::log_native(
            handle,
            "WARN",
            format!("[Audio] Failed to follow default output: {error}"),
        );
        return;
    }

    handle
        .emit("audio:default-device-changed", current_default)
        .ok();
}

#[cfg(target_os = "linux")]
fn audio_list_devices_pactl() -> Vec<AudioSink> {
    let output = match std::process::Command::new("pactl")
        .args(["--format=json", "list", "sinks"])
        .output()
    {
        Ok(output) if output.status.success() => output.stdout,
        _ => return Vec::new(),
    };

    let default_sink = std::process::Command::new("pactl")
        .args(["get-default-sink"])
        .output()
        .ok()
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .unwrap_or_default();

    let sinks: Vec<serde_json::Value> = match serde_json::from_slice(&output) {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };

    sinks
        .iter()
        .filter_map(|sink| {
            let name = sink.get("name")?.as_str()?.to_string();
            let description = sink.get("description")?.as_str()?.to_string();
            Some(AudioSink {
                is_default: name == default_sink,
                name,
                description,
            })
        })
        .collect()
}

#[cfg(not(target_os = "linux"))]
fn audio_list_devices_cpal() -> Vec<AudioSink> {
    use cpal::traits::{DeviceTrait, HostTrait};

    let host = cpal::default_host();
    let default_id = host
        .default_output_device()
        .and_then(|device| device.id().ok())
        .map(|id| id.to_string());

    let devices = match host.output_devices() {
        Ok(devices) => devices,
        Err(_) => return Vec::new(),
    };

    devices
        .filter_map(|dev| {
            let id = dev.id().ok()?.to_string();
            let description = dev
                .description()
                .ok()
                .map(|desc| desc.name().to_string())
                .unwrap_or_else(|| id.clone());
            Some(AudioSink {
                is_default: default_id.as_deref() == Some(id.as_str()),
                name: id,
                description,
            })
        })
        .collect()
}

pub fn current_default_output_name() -> Option<String> {
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("pactl")
            .args(["get-default-sink"])
            .output()
            .ok()
            .and_then(|output| {
                if output.status.success() {
                    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    (!value.is_empty()).then_some(value)
                } else {
                    None
                }
            })
    }
    #[cfg(not(target_os = "linux"))]
    {
        use cpal::traits::{DeviceTrait, HostTrait};

        cpal::default_host()
            .default_output_device()
            .and_then(|device| device.id().ok())
            .map(|id| id.to_string())
    }
}

fn switch_to_device_internal(
    state: &AudioState,
    device_name: Option<String>,
) -> Result<(), String> {
    let switch_name = resolve_switch_name(&device_name)?;
    swap_device_and_continue(state, switch_name)
}

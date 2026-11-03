use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::RecvTimeoutError;
use std::time::Duration;

use serde::Serialize;
use tauri::{Emitter, Manager};
use voice_audio::{Device, DeviceList, devices};
use voice_engine::Command;

use super::{MAIN, Voice};
use crate::rt::AppHandle;

const POLL: Duration = Duration::from_secs(2);
const CHECK_STOP: Duration = Duration::from_millis(500);

#[derive(Serialize, Clone)]
pub struct DeviceInfo {
    id: String,
    name: String,
    transport: &'static str,
    default: bool,
}

#[derive(Serialize, Clone)]
pub struct Devices {
    inputs: Vec<DeviceInfo>,
    outputs: Vec<DeviceInfo>,
}

fn info(device: &Device) -> DeviceInfo {
    DeviceInfo {
        id: device.id.clone(),
        name: device.name.clone(),
        transport: device.transport.as_str(),
        default: device.default,
    }
}

pub fn shape(list: &DeviceList) -> Devices {
    Devices {
        inputs: list.inputs.iter().map(info).collect(),
        outputs: list.outputs.iter().map(info).collect(),
    }
}

pub fn refresh(voice: &Voice) -> DeviceList {
    let list = devices::list();
    *voice.devices.lock().unwrap() = Some(list.clone());
    voice.engine.send(Command::Devices(list.clone()));
    list
}

pub fn current(voice: &Voice) -> DeviceList {
    let known = voice.devices.lock().unwrap().clone();
    known.unwrap_or_else(|| refresh(voice))
}

pub fn watch(app: &AppHandle, on: bool) {
    let voice = app.state::<Voice>();
    let mut running = voice.watching.lock().unwrap();
    if on == running.is_some() {
        return;
    }
    if let Some(stop) = running.take() {
        stop.store(true, Ordering::Relaxed);
        return;
    }
    let stop = Arc::new(AtomicBool::new(false));
    *running = Some(stop.clone());
    let app = app.clone();
    let _ = std::thread::Builder::new()
        .name("voice-hotplug".into())
        .spawn(move || {
            let list = refresh(&app.state::<Voice>());
            app.emit_to(MAIN, "voice:devices", shape(&list)).ok();
            let watcher = devices::watch(POLL);
            while !stop.load(Ordering::Relaxed) {
                match watcher.changes.recv_timeout(CHECK_STOP) {
                    Ok(list) => {
                        let voice = app.state::<Voice>();
                        *voice.devices.lock().unwrap() = Some(list.clone());
                        voice.engine.send(Command::Devices(list.clone()));
                        app.emit_to(MAIN, "voice:devices", shape(&list)).ok();
                    }
                    Err(RecvTimeoutError::Timeout) => {}
                    Err(RecvTimeoutError::Disconnected) => return,
                }
            }
        });
}

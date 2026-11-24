use std::path::Path;

use image::RgbaImage;
use objc2::{AllocAnyThread, MainThreadMarker};
use objc2_app_kit::{NSApplication, NSImage};
use objc2_foundation::NSData;

use super::picture;
use crate::app::diagnostics;
use crate::rt::AppHandle;

const DOCK: u32 = 512;
const DOCK_INNER: u32 = 412;

pub fn show(app: &AppHandle, chosen: Option<&RgbaImage>) {
    let png = match chosen.map(dock_png).transpose() {
        Ok(png) => png,
        Err(error) => {
            diagnostics::warn(format!("[AppIcon] dock icon: {error}"));
            return;
        }
    };
    let _ = app.run_on_main_thread(move || set_dock(png.as_deref()));
}

pub fn install(
    _app: &AppHandle,
    _data_dir: &Path,
    _chosen: Option<&RgbaImage>,
) -> Result<(), String> {
    Ok(())
}

fn dock_png(chosen: &RgbaImage) -> Result<Vec<u8>, String> {
    picture::encode(&picture::with_margin(chosen, DOCK, DOCK_INNER))
}

fn set_dock(png: Option<&[u8]>) {
    let Some(main_thread) = MainThreadMarker::new() else {
        return;
    };
    let image =
        png.and_then(|png| NSImage::initWithData(NSImage::alloc(), &NSData::with_bytes(png)));
    unsafe {
        NSApplication::sharedApplication(main_thread).setApplicationIconImage(image.as_deref())
    };
}

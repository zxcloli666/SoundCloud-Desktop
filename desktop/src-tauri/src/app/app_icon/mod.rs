#[cfg(any(target_os = "linux", test))]
mod hicolor;
#[cfg(any(windows, test))]
mod ico;
mod picture;
#[cfg(windows)]
mod shortcuts;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
use linux as platform;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
use macos as platform;
#[cfg(windows)]
mod windows;
#[cfg(windows)]
use windows as platform;

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use image::RgbaImage;
use tauri::Manager;
use tauri::image::Image;
use tauri::ipc::{InvokeBody, Request};

use crate::app::{diagnostics, tray};
use crate::rt::AppHandle;

const FILE: &str = "app-icon.png";

pub struct AppIcon {
    dir: PathBuf,
    chosen: Mutex<Option<Arc<RgbaImage>>>,
}

impl AppIcon {
    pub fn load(data_dir: &Path) -> Self {
        let chosen = std::fs::read(data_dir.join(FILE))
            .ok()
            .and_then(|png| picture::decode(&png).ok());
        Self {
            dir: data_dir.to_path_buf(),
            chosen: Mutex::new(chosen.map(Arc::new)),
        }
    }

    fn chosen(&self) -> Option<Arc<RgbaImage>> {
        self.chosen.lock().unwrap().clone()
    }

    fn replace(&self, png: Option<&[u8]>) -> Result<bool, String> {
        let file = self.dir.join(FILE);
        let saved = std::fs::read(&file).ok();
        if saved.as_deref() == png {
            return Ok(false);
        }
        let picture = png.map(picture::decode).transpose()?;
        match png {
            Some(png) => std::fs::write(&file, png),
            None => std::fs::remove_file(&file),
        }
        .map_err(|e| e.to_string())?;
        *self.chosen.lock().unwrap() = picture.map(Arc::new);
        Ok(true)
    }
}

pub fn shown(app: &AppHandle, size: u32) -> Option<Image<'static>> {
    match app.state::<AppIcon>().chosen() {
        Some(chosen) => Some(picture::to_tauri(picture::fit(&chosen, size))),
        None => app
            .default_window_icon()
            .map(|icon| icon.clone().to_owned()),
    }
}

pub fn restore(app: &AppHandle) {
    if app.state::<AppIcon>().chosen().is_some() {
        let app = app.clone();
        tauri::async_runtime::spawn_blocking(move || apply(&app));
    }
}

#[tauri::command]
pub async fn app_icon_set(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let png = match request.body() {
        InvokeBody::Raw(body) => body.clone(),
        InvokeBody::Json(value) => {
            serde_json::from_value::<Vec<u8>>(value.clone()).map_err(|e| e.to_string())?
        }
    };
    change(app, Some(png)).await
}

#[tauri::command]
pub async fn app_icon_reset(app: AppHandle) -> Result<(), String> {
    change(app, None).await
}

async fn change(app: AppHandle, png: Option<Vec<u8>>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if app.state::<AppIcon>().replace(png.as_deref())? {
            tray::refresh_icon(&app);
            apply(&app);
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

fn apply(app: &AppHandle) {
    let state = app.state::<AppIcon>();
    let chosen = state.chosen();
    platform::show(app, chosen.as_deref());
    if let Err(error) = platform::install(app, &state.dir, chosen.as_deref()) {
        diagnostics::warn(format!("[AppIcon] the icon is not set everywhere: {error}"));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn data_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("scd-app-icon-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn png(shade: u8) -> Vec<u8> {
        let picture = RgbaImage::from_pixel(8, 8, image::Rgba([shade, 0, 0, 255]));
        picture::encode(&picture).unwrap()
    }

    #[test]
    fn the_chosen_icon_is_read_back_at_the_next_start() {
        let dir = data_dir();
        assert!(AppIcon::load(&dir).chosen().is_none());
        assert!(AppIcon::load(&dir).replace(Some(&png(9))).unwrap());
        let chosen = AppIcon::load(&dir).chosen().unwrap();
        assert_eq!(chosen.get_pixel(0, 0).0, [9, 0, 0, 255]);
    }

    #[test]
    fn the_same_icon_is_not_applied_twice() {
        let icon = AppIcon::load(&data_dir());
        assert!(!icon.replace(None).unwrap());
        assert!(icon.replace(Some(&png(1))).unwrap());
        assert!(!icon.replace(Some(&png(1))).unwrap());
        assert!(icon.replace(None).unwrap());
        assert!(icon.chosen().is_none());
    }

    #[test]
    fn a_broken_picture_leaves_the_old_icon() {
        let icon = AppIcon::load(&data_dir());
        icon.replace(Some(&png(5))).unwrap();
        assert!(icon.replace(Some(b"not a picture")).is_err());
        assert_eq!(icon.chosen().unwrap().get_pixel(0, 0).0[0], 5);
        assert!(!icon.replace(Some(&png(5))).unwrap());
    }
}

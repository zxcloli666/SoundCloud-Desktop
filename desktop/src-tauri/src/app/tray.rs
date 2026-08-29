//! System tray.
//!
//! Linux: нативный StatusNotifierItem через `ksni` (D-Bus, без GTK) — работает и в
//! wry, и в CEF-рантайме (CEF не инициализирует GTK, поэтому GTK-путь tray-icon/muda
//! паниковал бы `GTK has not been initialized`).
//! Windows/macOS: нативный Tauri `tray-icon`/`muda` (Win32 Shell_NotifyIcon / AppKit
//! NSStatusItem) — GTK там не нужен, под CEF работает.
//!
//! Колбэки трея могут приходить НЕ с main-потока (у ksni — задача D-Bus), а оконные
//! операции Tauri обязаны идти с main-потока → действия гоним через
//! `run_on_main_thread`.

use tauri::{Emitter, Manager};

use crate::app::popover;
use crate::rt::AppHandle;

pub fn setup_tray(app: &crate::rt::App) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "linux")]
    {
        linux::setup(app);
        Ok(())
    }
    #[cfg(not(target_os = "linux"))]
    {
        native::setup(app)
    }
}

/// Выполнить действие пункта меню на main-потоке.
fn run_action(app: &AppHandle, id: &str) {
    let h = app.clone();
    let id = id.to_string();
    let _ = app.run_on_main_thread(move || match id.as_str() {
        "show" => {
            if let Some(w) = h.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }
        "mini" => popover::open_pinned(&h),
        "quit" => {
            // На CEF graceful `app.exit()` может зависнуть в teardown (кросс-процессный
            // OnBeforeClose окон/вебвью не завершается) → жёсткий выход; Chromium-хелперы
            // сами умирают по смерти родителя. На wry — обычный graceful exit.
            #[cfg(feature = "cef")]
            std::process::exit(0);
            #[cfg(not(feature = "cef"))]
            h.exit(0);
        }
        "play_pause" | "next" | "prev" => {
            let _ = h.emit("tray-action", id.as_str());
        }
        _ => {}
    });
}

/// Тоггл мини-плеера у точки клика (на main-потоке).
fn toggle_popover(app: &AppHandle, cursor: Option<(f64, f64)>) {
    let h = app.clone();
    let _ = app.run_on_main_thread(move || popover::toggle(&h, cursor));
}

// ---------------------------------------------------------------------------
// Linux: ksni / StatusNotifierItem (без GTK)
// ---------------------------------------------------------------------------
#[cfg(target_os = "linux")]
mod linux {
    use ksni::{MenuItem, Tray, TrayMethods};

    use crate::rt::AppHandle;

    struct ScTray {
        app: AppHandle,
        icon: Vec<ksni::Icon>,
    }

    impl Tray for ScTray {
        fn id(&self) -> String {
            "com.soundcloud.desktop".into()
        }
        fn title(&self) -> String {
            "Sonveil".into()
        }
        fn icon_pixmap(&self) -> Vec<ksni::Icon> {
            self.icon.clone()
        }
        // Левый клик по иконке → мини-плеер у курсора.
        fn activate(&mut self, x: i32, y: i32) {
            super::toggle_popover(&self.app, Some((x as f64, y as f64)));
        }
        fn menu(&self) -> Vec<MenuItem<Self>> {
            use ksni::menu::StandardItem;
            let item = |label: &str, id: &'static str| -> MenuItem<Self> {
                StandardItem {
                    label: label.into(),
                    activate: Box::new(move |t: &mut Self| super::run_action(&t.app, id)),
                    ..Default::default()
                }
                .into()
            };
            vec![
                item("Show", "show"),
                item("Mini player", "mini"),
                MenuItem::Separator,
                item("Play / Pause", "play_pause"),
                item("Previous", "prev"),
                item("Next", "next"),
                MenuItem::Separator,
                item("Quit", "quit"),
            ]
        }
    }

    pub fn setup(app: &crate::rt::App) {
        let handle = app.handle().clone();
        let icon = icon_pixmap(app);
        // ksni поднимает D-Bus-сервис на нашем tokio-рантайме; держим задачу живой.
        tauri::async_runtime::spawn(async move {
            let tray = ScTray { app: handle, icon };
            match tray.spawn().await {
                Ok(_handle) => std::future::pending::<()>().await,
                Err(err) => eprintln!("[tray] ksni spawn failed: {err}"),
            }
        });
    }

    /// Иконка приложения → ARGB32-пиксмап SNI (RGBA из Tauri → A,R,G,B).
    fn icon_pixmap(app: &crate::rt::App) -> Vec<ksni::Icon> {
        let Some(img) = app.default_window_icon() else {
            return Vec::new();
        };
        let rgba = img.rgba();
        let mut data = Vec::with_capacity(rgba.len());
        for px in rgba.chunks_exact(4) {
            data.extend_from_slice(&[px[3], px[0], px[1], px[2]]);
        }
        vec![ksni::Icon {
            width: img.width() as i32,
            height: img.height() as i32,
            data,
        }]
    }
}

// ---------------------------------------------------------------------------
// Windows / macOS: нативный Tauri tray-icon / muda
// ---------------------------------------------------------------------------
#[cfg(not(target_os = "linux"))]
mod native {
    use tauri::menu::{MenuBuilder, MenuItemBuilder};
    use tauri::tray::TrayIconBuilder;
    use tauri::Manager;

    pub fn setup(app: &crate::rt::App) -> Result<(), Box<dyn std::error::Error>> {
        let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
        let mini = MenuItemBuilder::with_id("mini", "Mini player").build(app)?;
        let play_pause = MenuItemBuilder::with_id("play_pause", "Play / Pause").build(app)?;
        let next = MenuItemBuilder::with_id("next", "Next").build(app)?;
        let prev = MenuItemBuilder::with_id("prev", "Previous").build(app)?;
        let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

        let menu = MenuBuilder::new(app)
            .items(&[&show, &mini, &play_pause, &prev, &next, &quit])
            .build()?;

        TrayIconBuilder::new()
            .icon(app.default_window_icon().cloned().expect("no app icon"))
            .tooltip("Sonveil")
            .menu(&menu)
            // Левый клик открывает мини-плеер (ниже); меню — на правый клик.
            .show_menu_on_left_click(false)
            .on_menu_event(|app, event| super::run_action(app, event.id().as_ref()))
            .on_tray_icon_event(|tray, event| {
                // Release-only: Click шлёт и press, и release — иначе тоггл срабатывает
                // дважды за клик и поповер мгновенно исчезает.
                if let tauri::tray::TrayIconEvent::Click {
                    button: tauri::tray::MouseButton::Left,
                    button_state: tauri::tray::MouseButtonState::Up,
                    position,
                    ..
                } = event
                {
                    super::toggle_popover(tray.app_handle(), Some((position.x, position.y)));
                }
            })
            .build(app)?;

        Ok(())
    }
}

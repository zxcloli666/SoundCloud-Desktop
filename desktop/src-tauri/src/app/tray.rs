//! System tray.
//!
//! Linux: нативный StatusNotifierItem через `ksni` (D-Bus, без GTK).
//! Windows/macOS: нативный Tauri `tray-icon`/`muda` (Win32 Shell_NotifyIcon / AppKit
//! NSStatusItem).
//!
//! Колбэки трея могут приходить НЕ с main-потока (у ksni — задача D-Bus), а оконные
//! операции Tauri обязаны идти с main-потока → действия гоним через
//! `run_on_main_thread`.

use tauri::{Emitter, Manager};

use crate::app::{popover, visibility};
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

pub fn is_available() -> bool {
    #[cfg(target_os = "linux")]
    {
        linux::is_online()
    }
    #[cfg(not(target_os = "linux"))]
    {
        true
    }
}

pub fn probe() -> bool {
    #[cfg(target_os = "linux")]
    {
        linux::probe()
    }
    #[cfg(not(target_os = "linux"))]
    {
        true
    }
}

pub fn refresh_labels(app: &AppHandle) {
    #[cfg(target_os = "linux")]
    {
        linux::refresh_labels(app);
    }
    #[cfg(not(target_os = "linux"))]
    {
        native::refresh_labels(app);
    }
}

pub fn set_unread(app: &AppHandle, unread: bool) {
    #[cfg(target_os = "linux")]
    {
        linux::set_unread(app, unread);
    }
    #[cfg(not(target_os = "linux"))]
    {
        native::set_unread(app, unread);
    }
}

/// Выполнить действие пункта меню на main-потоке.
pub fn run_action(app: &AppHandle, id: &str) {
    let h = app.clone();
    let id = id.to_string();
    let _ = app.run_on_main_thread(move || match id.as_str() {
        "show" => visibility::show_main(&h),
        "mini" => popover::open_pinned(&h),
        "quit" => {
            h.state::<popover::TrayState>().persist_position();
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
    use std::path::Path;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::time::Duration;

    use ksni::{Handle, MenuItem, OfflineReason, Tray, TrayMethods};
    use tauri::Manager;
    use zbus::Connection;
    use zbus::fdo::DBusProxy;
    use zbus::names::BusName;

    use crate::app::autostart;
    use crate::app::diagnostics::log_native;
    use crate::app::tray_labels;
    use crate::rt::AppHandle;

    const WATCHER: &str = "org.kde.StatusNotifierWatcher";
    const PROBE_TIMEOUT: Duration = Duration::from_millis(1500);

    static ONLINE: AtomicBool = AtomicBool::new(true);

    struct Spawned(Handle<ScTray>);

    pub fn is_online() -> bool {
        ONLINE.load(Ordering::Relaxed)
    }

    async fn watcher_registered() -> Result<bool, String> {
        let connection = Connection::session().await.map_err(|e| e.to_string())?;
        let dbus = DBusProxy::new(&connection)
            .await
            .map_err(|e| e.to_string())?;
        let name = BusName::try_from(WATCHER).map_err(|e| e.to_string())?;
        dbus.name_has_owner(name).await.map_err(|e| e.to_string())
    }

    pub fn probe() -> bool {
        let online = tauri::async_runtime::block_on(async {
            tokio::time::timeout(PROBE_TIMEOUT, watcher_registered()).await
        })
        .is_ok_and(|registered| registered.unwrap_or(false));
        ONLINE.store(online, Ordering::Relaxed);
        online
    }

    pub fn refresh_labels(app: &AppHandle) {
        let Some(spawned) = app.try_state::<Spawned>() else {
            return;
        };
        let tray = spawned.0.clone();
        tauri::async_runtime::spawn(async move {
            tray.update(|_| ()).await;
        });
    }

    pub fn set_unread(app: &AppHandle, unread: bool) {
        let Some(spawned) = app.try_state::<Spawned>() else {
            return;
        };
        let tray = spawned.0.clone();
        tauri::async_runtime::spawn(async move {
            tray.update(|tray| tray.unread = unread).await;
        });
    }

    fn go_offline(app: &AppHandle) {
        ONLINE.store(false, Ordering::Relaxed);
        autostart::reveal_if_hidden(app);
    }

    fn is_flatpak() -> bool {
        Path::new("/.flatpak-info").exists()
    }

    struct ScTray {
        app: AppHandle,
        icon: Vec<ksni::Icon>,
        dotted: Vec<ksni::Icon>,
        unread: bool,
    }

    impl Tray for ScTray {
        fn id(&self) -> String {
            "com.soundcloud.desktop".into()
        }
        fn title(&self) -> String {
            "SoundCloud Desktop".into()
        }
        fn icon_pixmap(&self) -> Vec<ksni::Icon> {
            if self.unread {
                self.dotted.clone()
            } else {
                self.icon.clone()
            }
        }
        // Левый клик по иконке → мини-плеер у курсора.
        fn activate(&mut self, x: i32, y: i32) {
            super::toggle_popover(&self.app, Some((x as f64, y as f64)));
        }
        fn menu(&self) -> Vec<MenuItem<Self>> {
            use ksni::menu::StandardItem;
            let labels = tray_labels::current();
            let item = |label: &str, id: &'static str| -> MenuItem<Self> {
                StandardItem {
                    label: label.into(),
                    activate: Box::new(move |t: &mut Self| super::run_action(&t.app, id)),
                    ..Default::default()
                }
                .into()
            };
            vec![
                item(&labels.show, "show"),
                item(&labels.mini, "mini"),
                MenuItem::Separator,
                item(&labels.play_pause, "play_pause"),
                item(&labels.prev, "prev"),
                item(&labels.next, "next"),
                MenuItem::Separator,
                item(&labels.quit, "quit"),
            ]
        }
        fn watcher_online(&self) {
            ONLINE.store(true, Ordering::Relaxed);
            log_native(&self.app, "INFO", "[tray] status notifier watcher is back");
        }
        fn watcher_offline(&self, reason: OfflineReason) -> bool {
            go_offline(&self.app);
            log_native(
                &self.app,
                "WARN",
                format!("[tray] status notifier watcher is offline: {reason:?}"),
            );
            true
        }
    }

    pub fn setup(app: &crate::rt::App) {
        let handle = app.handle().clone();
        let (icon, dotted) = icon_pixmaps(app);
        // ksni поднимает D-Bus-сервис на нашем tokio-рантайме; держим задачу живой.
        tauri::async_runtime::spawn(async move {
            let tray = ScTray {
                app: handle.clone(),
                icon,
                dotted,
                unread: false,
            };
            let spawned = tray
                .assume_sni_available(true)
                .disable_dbus_name(is_flatpak())
                .spawn()
                .await;
            match spawned {
                Ok(tray) => {
                    handle.manage(Spawned(tray.clone()));
                    tray.update(|tray| tray.unread = crate::chat::badge::has_unread())
                        .await;
                    std::future::pending::<()>().await
                }
                Err(err) => {
                    go_offline(&handle);
                    log_native(&handle, "ERROR", format!("[tray] ksni spawn failed: {err}"));
                }
            }
        });
    }

    fn icon_pixmaps(app: &crate::rt::App) -> (Vec<ksni::Icon>, Vec<ksni::Icon>) {
        let Some(img) = app.default_window_icon() else {
            return (Vec::new(), Vec::new());
        };
        let dotted = crate::app::tray_dot::with_dot(img.rgba(), img.width(), img.height());
        (
            pixmap(img.rgba(), img.width(), img.height()),
            pixmap(&dotted, img.width(), img.height()),
        )
    }

    fn pixmap(rgba: &[u8], width: u32, height: u32) -> Vec<ksni::Icon> {
        let mut data = Vec::with_capacity(rgba.len());
        for [r, g, b, a] in rgba.as_chunks::<4>().0 {
            data.extend_from_slice(&[*a, *r, *g, *b]);
        }
        vec![ksni::Icon {
            width: width as i32,
            height: height as i32,
            data,
        }]
    }
}

// ---------------------------------------------------------------------------
// Windows / macOS: нативный Tauri tray-icon / muda
// ---------------------------------------------------------------------------
#[cfg(not(target_os = "linux"))]
mod native {
    use tauri::Manager;
    use tauri::image::Image;
    use tauri::menu::{MenuBuilder, MenuItem, MenuItemBuilder};
    use tauri::tray::{TrayIcon, TrayIconBuilder};

    use crate::app::tray_dot::with_dot;
    use crate::app::tray_labels::{self, TrayLabels};
    use crate::rt::{AppHandle, Rt};

    struct Icons {
        tray: TrayIcon<Rt>,
        plain: Image<'static>,
        dotted: Image<'static>,
    }

    pub fn set_unread(app: &AppHandle, unread: bool) {
        let Some(icons) = app.try_state::<Icons>() else {
            return;
        };
        let image = if unread { &icons.dotted } else { &icons.plain };
        let _ = icons.tray.set_icon(Some(image.clone()));
    }

    struct Items {
        show: MenuItem<Rt>,
        mini: MenuItem<Rt>,
        play_pause: MenuItem<Rt>,
        prev: MenuItem<Rt>,
        next: MenuItem<Rt>,
        quit: MenuItem<Rt>,
    }

    impl Items {
        fn build(app: &crate::rt::App, labels: &TrayLabels) -> tauri::Result<Self> {
            let item = |id: &str, label: &str| MenuItemBuilder::with_id(id, label).build(app);
            Ok(Self {
                show: item("show", &labels.show)?,
                mini: item("mini", &labels.mini)?,
                play_pause: item("play_pause", &labels.play_pause)?,
                prev: item("prev", &labels.prev)?,
                next: item("next", &labels.next)?,
                quit: item("quit", &labels.quit)?,
            })
        }

        fn relabel(&self, labels: &TrayLabels) {
            let _ = self.show.set_text(&labels.show);
            let _ = self.mini.set_text(&labels.mini);
            let _ = self.play_pause.set_text(&labels.play_pause);
            let _ = self.prev.set_text(&labels.prev);
            let _ = self.next.set_text(&labels.next);
            let _ = self.quit.set_text(&labels.quit);
        }
    }

    pub fn refresh_labels(app: &AppHandle) {
        if let Some(items) = app.try_state::<Items>() {
            items.relabel(&tray_labels::current());
        }
    }

    pub fn setup(app: &crate::rt::App) -> Result<(), Box<dyn std::error::Error>> {
        let items = Items::build(app, &tray_labels::current())?;

        let menu = MenuBuilder::new(app)
            .items(&[
                &items.show,
                &items.mini,
                &items.play_pause,
                &items.prev,
                &items.next,
                &items.quit,
            ])
            .build()?;
        app.manage(items);

        let icon = app.default_window_icon().expect("no app icon");
        let (width, height) = (icon.width(), icon.height());
        let plain = Image::new_owned(icon.rgba().to_vec(), width, height);
        let dotted = Image::new_owned(with_dot(icon.rgba(), width, height), width, height);

        let tray = TrayIconBuilder::new()
            .icon(plain.clone())
            .tooltip("SoundCloud Desktop")
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
        app.manage(Icons {
            tray,
            plain,
            dotted,
        });

        Ok(())
    }
}

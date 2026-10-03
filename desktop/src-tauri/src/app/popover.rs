//! Tray-popover window: a frameless, transparent, always-on-top mini-player webview
//! anchored to the tray icon. Created lazily on first open and kept alive (hidden)
//! thereafter. Opened pinned (no blur-dismiss) from both the tray left-click and the
//! "Mini player" menu — closed by a re-click or its ✕. The `last_hide` instant
//! debounces the hide-then-click race so a re-click never reopens what just closed.
//! Linux (appindicator) emits no left-click — the "Mini player" menu opens it in a
//! screen corner instead.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::app::visibility;
use crate::rt::{AppHandle, WebviewWindow};
use tauri::{Manager, Monitor, PhysicalPosition, WebviewUrl, WebviewWindowBuilder};

pub const LABEL: &str = "tray-popover";

/// Logical popover size (px). Physical size is scaled per-monitor when positioning.
const W: f64 = 384.0;
const H: f64 = 248.0;
const GAP: f64 = 10.0;
const MARGIN: f64 = 8.0;
const REOPEN_DEBOUNCE: Duration = Duration::from_millis(250);

#[derive(Default)]
pub struct TrayState {
    last_hide: Mutex<Option<Instant>>,
    /// Pinned → persistent widget: focus loss does NOT dismiss it, only a re-click or the
    /// ✕ does. Both the "Mini player" menu and the tray left-click open pinned — the
    /// tray-click focus dance on Win/Mac would otherwise blur-dismiss it instantly.
    pinned: Mutex<bool>,
}

impl TrayState {
    pub fn mark_hidden(&self) {
        if let Ok(mut g) = self.last_hide.lock() {
            *g = Some(Instant::now());
        }
    }

    fn recently_hidden(&self) -> bool {
        self.last_hide
            .lock()
            .ok()
            .and_then(|g| *g)
            .map(|t| t.elapsed() < REOPEN_DEBOUNCE)
            .unwrap_or(false)
    }

    fn set_pinned(&self, value: bool) {
        if let Ok(mut g) = self.pinned.lock() {
            *g = value;
        }
    }

    pub fn is_pinned(&self) -> bool {
        self.pinned.lock().map(|g| *g).unwrap_or(false)
    }
}

fn get_or_create(app: &AppHandle) -> Option<WebviewWindow> {
    if let Some(w) = app.get_webview_window(LABEL) {
        return Some(w);
    }
    match WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("tray.html".into()))
        .title("Mini Player")
        .inner_size(W, H)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        // CEF применяет set_size только к resizable-окну (can_resize спрашивается раз,
        // при создании; живой set_resizable не действует). Делаем окно resizable, а от
        // ручного ресайза запираем равными min==max (live-делегаты minimum/maximum_size).
        .resizable(cfg!(feature = "cef"))
        .min_inner_size(W, H)
        .max_inner_size(W, H)
        .shadow(false)
        .visible(false)
        .focused(false)
        .build()
    {
        Ok(w) => Some(w),
        Err(err) => {
            eprintln!("[tray] failed to create popover: {err}");
            None
        }
    }
}

fn pick_monitor(win: &WebviewWindow, cursor: Option<(f64, f64)>) -> Option<Monitor> {
    let monitors = win.available_monitors().unwrap_or_default();
    if let Some((cx, cy)) = cursor {
        for m in &monitors {
            let p = m.position();
            let s = m.size();
            if cx >= p.x as f64
                && cx < p.x as f64 + s.width as f64
                && cy >= p.y as f64
                && cy < p.y as f64 + s.height as f64
            {
                return Some(m.clone());
            }
        }
    }
    win.primary_monitor()
        .ok()
        .flatten()
        .or_else(|| monitors.into_iter().next())
}

fn place(win: &WebviewWindow, cursor: Option<(f64, f64)>) {
    let Some(mon) = pick_monitor(win, cursor) else {
        return;
    };
    let scale = mon.scale_factor();
    let mp = mon.position();
    let ms = mon.size();
    let (mx, my, mw, mh) = (
        mp.x as f64,
        mp.y as f64,
        ms.width as f64,
        ms.height as f64,
    );
    let (pw, ph, gap, margin) = (W * scale, H * scale, GAP * scale, MARGIN * scale);

    // No cursor (Linux menu path) → anchor to the bottom-right corner of the monitor.
    let (ax, ay) = cursor.unwrap_or((mx + mw - pw / 2.0 - margin, my + mh - margin));

    // Icon in the top half of the screen → drop the popover below it; bottom half → above.
    let y = if ay < my + mh / 2.0 {
        ay + gap
    } else {
        ay - ph - gap
    };
    let x = (ax - pw / 2.0)
        .max(mx + margin)
        .min(mx + mw - pw - margin);
    let y = y.max(my + margin).min(my + mh - ph - margin);

    let _ = win.set_position(PhysicalPosition::new(x as i32, y as i32));
}

fn show(app: &AppHandle, cursor: Option<(f64, f64)>, pinned: bool) {
    let Some(win) = get_or_create(app) else {
        return;
    };
    app.state::<TrayState>().set_pinned(pinned);
    // Re-assert on every show — keeps the flyout above other windows even after a
    // re-open (honored on Win/Mac; on Wayland/Hyprland the compositor owns stacking,
    // so pair this with a `pin` windowrule).
    let _ = win.set_always_on_top(true);
    visibility::set_page_visible(&win, true);

    #[cfg(not(feature = "cef"))]
    {
        place(&win, cursor);
        let _ = win.show();
        let _ = win.set_focus();
    }

    // CEF не привязывает `display()` к прозрачному frameless-окну до его маппинга,
    // а size/position гейтятся на `display()` (иначе остаётся дефолт CEF 800×600).
    // Поэтому: показываем, затем форсим размер+позицию — синхронно и отложенно,
    // на случай асинхронного маппинга окна.
    #[cfg(feature = "cef")]
    {
        let _ = win.show();
        let _ = win.set_focus();
        apply_geometry(&win, cursor);
        let app = app.clone();
        let win = win.clone();
        tauri::async_runtime::spawn(async move {
            // display() появляется только после маппинга окна.
            tokio::time::sleep(std::time::Duration::from_millis(80)).await;
            let _ = app.run_on_main_thread(move || apply_geometry(&win, cursor));
        });
    }
}

/// Принудительный логический размер + позиция (CEF игнорит inner_size окна).
#[cfg(feature = "cef")]
fn apply_geometry(win: &WebviewWindow, cursor: Option<(f64, f64)>) {
    let _ = win.set_size(tauri::LogicalSize::new(W, H));
    place(win, cursor);
}

fn hide_if_visible(app: &AppHandle) -> bool {
    if let Some(win) = app.get_webview_window(LABEL)
        && win.is_visible().unwrap_or(false) {
            let _ = win.hide();
            visibility::set_page_visible(&win, false);
            app.state::<TrayState>().mark_hidden();
            return true;
        }
    false
}

/// Tray left-click (Win/Mac): toggles a pinned popover anchored at the click point.
/// Pinned like the menu — the tray-click focus dance would otherwise blur-dismiss it
/// instantly; a second click or its ✕ closes it. `cursor` is the click point in physical px.
pub fn toggle(app: &AppHandle, cursor: Option<(f64, f64)>) {
    if hide_if_visible(app) {
        return;
    }
    // Debounce a click landing right after a hide (the "close" half of a re-click).
    if app.state::<TrayState>().recently_hidden() {
        return;
    }
    show(app, cursor, true);
}

/// "Mini player" menu: pinned, corner-positioned, persistent widget (no blur-dismiss).
/// Toggles — a second menu click hides it. The only path on Linux (no tray left-click).
pub fn open_pinned(app: &AppHandle) {
    if hide_if_visible(app) {
        return;
    }
    show(app, None, true);
}

#[tauri::command]
pub async fn tray_popover_hide(app: AppHandle) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        hide_if_visible(&handle);
    });
}

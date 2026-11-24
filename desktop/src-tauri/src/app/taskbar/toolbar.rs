use std::cell::{Cell, OnceCell};
use std::error::Error;

use tauri::Manager;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::Com::{CLSCTX_INPROC_SERVER, CoCreateInstance};
use windows::Win32::UI::Shell::{
    DefSubclassProc, ITaskbarList3, SetWindowSubclass, THB_FLAGS, THB_ICON, THB_TOOLTIP,
    THBF_ENABLED, THBN_CLICKED, THUMBBUTTON, TaskbarList,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateIcon, GetSystemMetrics, HICON, RegisterWindowMessageW, SM_CXSMICON, WM_COMMAND,
    WM_SETTINGCHANGE,
};
use windows::core::w;

use super::button::Button;
use super::glyph::{self, Glyph};
use crate::app::{diagnostics, tray, tray_labels};
use crate::rt::{App, AppHandle};

const SUBCLASS_ID: usize = 1;
const LIGHT_INK: u8 = 255;
const DARK_INK: u8 = 28;

thread_local! {
    static TOOLBAR: OnceCell<&'static Toolbar> = const { OnceCell::new() };
}

struct Toolbar {
    app: AppHandle,
    hwnd: HWND,
    list: ITaskbarList3,
    created: u32,
    on_dark: Icons,
    on_light: Icons,
    light: Cell<bool>,
    playing: Cell<bool>,
    failed: Cell<bool>,
}

pub fn attach(app: &App) {
    if let Err(error) = install(app) {
        warn(&error);
    }
}

pub fn set_playing(app: &AppHandle, playing: bool) {
    on_main(app, move |toolbar| {
        if toolbar.playing.replace(playing) != playing {
            toolbar.update();
        }
    });
}

pub fn refresh_labels(app: &AppHandle) {
    on_main(app, Toolbar::update);
}

fn install(app: &App) -> Result<(), Box<dyn Error>> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };
    let hwnd = window.hwnd()?;
    let list: ITaskbarList3 =
        unsafe { CoCreateInstance(&TaskbarList, None, CLSCTX_INPROC_SERVER) }?;
    unsafe { list.HrInit() }?;
    let toolbar: &'static Toolbar = Box::leak(Box::new(Toolbar {
        app: app.handle().clone(),
        hwnd,
        list,
        created: unsafe { RegisterWindowMessageW(w!("TaskbarButtonCreated")) },
        on_dark: Icons::new(LIGHT_INK)?,
        on_light: Icons::new(DARK_INK)?,
        light: Cell::new(taskbar_is_light()),
        playing: Cell::new(false),
        failed: Cell::new(false),
    }));
    unsafe {
        SetWindowSubclass(
            hwnd,
            Some(on_message),
            SUBCLASS_ID,
            toolbar as *const Toolbar as usize,
        )
    }
    .ok()?;
    TOOLBAR.with(|slot| slot.set(toolbar)).ok();
    Ok(())
}

fn on_main(app: &AppHandle, run: impl FnOnce(&Toolbar) + Send + 'static) {
    let _ = app.run_on_main_thread(move || {
        TOOLBAR.with(|slot| {
            if let Some(toolbar) = slot.get() {
                run(toolbar);
            }
        });
    });
}

unsafe extern "system" fn on_message(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _subclass: usize,
    toolbar: usize,
) -> LRESULT {
    let toolbar = unsafe { &*(toolbar as *const Toolbar) };
    match message {
        WM_COMMAND => {
            if let Some(button) = clicked(wparam) {
                tray::run_action(&toolbar.app, button.action());
                return LRESULT(0);
            }
        }
        WM_SETTINGCHANGE => toolbar.follow_theme(),
        created if created == toolbar.created => toolbar.add(),
        _ => {}
    }
    unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
}

fn clicked(wparam: WPARAM) -> Option<Button> {
    let notice = (wparam.0 >> 16) as u32 & 0xffff;
    let id = wparam.0 as u32 & 0xffff;
    Button::from_id(id).filter(|_| notice == THBN_CLICKED)
}

impl Toolbar {
    fn add(&self) {
        let added = unsafe { self.list.ThumbBarAddButtons(self.hwnd, &self.buttons()) };
        if let Err(error) = added
            && !self.failed.replace(true)
        {
            warn(&error);
        }
    }

    fn update(&self) {
        let _ = unsafe { self.list.ThumbBarUpdateButtons(self.hwnd, &self.buttons()) };
    }

    fn follow_theme(&self) {
        let light = taskbar_is_light();
        if self.light.replace(light) != light {
            self.update();
        }
    }

    fn buttons(&self) -> [THUMBBUTTON; 3] {
        let labels = tray_labels::current();
        let icons = if self.light.get() {
            &self.on_light
        } else {
            &self.on_dark
        };
        Button::ALL.map(|button| THUMBBUTTON {
            dwMask: THB_ICON | THB_TOOLTIP | THB_FLAGS,
            iId: button.id(),
            iBitmap: 0,
            hIcon: icons.get(button.glyph(self.playing.get())),
            szTip: button.tip(&labels),
            dwFlags: THBF_ENABLED,
        })
    }
}

struct Icons {
    previous: HICON,
    play: HICON,
    pause: HICON,
    next: HICON,
}

impl Icons {
    fn new(ink: u8) -> windows::core::Result<Self> {
        Ok(Self {
            previous: icon(Glyph::Previous, ink)?,
            play: icon(Glyph::Play, ink)?,
            pause: icon(Glyph::Pause, ink)?,
            next: icon(Glyph::Next, ink)?,
        })
    }

    fn get(&self, glyph: Glyph) -> HICON {
        match glyph {
            Glyph::Previous => self.previous,
            Glyph::Play => self.play,
            Glyph::Pause => self.pause,
            Glyph::Next => self.next,
        }
    }
}

fn icon(glyph: Glyph, ink: u8) -> windows::core::Result<HICON> {
    let size = unsafe { GetSystemMetrics(SM_CXSMICON) }.max(16);
    let pixels = glyph::render(glyph, size as u32, ink);
    let mask = vec![0; mask_row(size as usize) * size as usize];
    unsafe { CreateIcon(None, size, size, 1, 32, mask.as_ptr(), pixels.as_ptr()) }
}

fn mask_row(width: usize) -> usize {
    width.div_ceil(16) * 2
}

fn taskbar_is_light() -> bool {
    windows_registry::CURRENT_USER
        .open(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize")
        .and_then(|key| key.get_u32("SystemUsesLightTheme"))
        .is_ok_and(|light| light == 1)
}

fn warn(error: &dyn std::fmt::Display) {
    diagnostics::warn(format!(
        "[Taskbar] playback buttons are unavailable: {error}"
    ));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command(notice: u32, id: u32) -> WPARAM {
        WPARAM(((notice << 16) | id) as usize)
    }

    #[test]
    fn only_thumb_button_clicks_are_taken() {
        assert_eq!(clicked(command(THBN_CLICKED, 2)), Some(Button::PlayPause));
        assert_eq!(clicked(command(THBN_CLICKED, 9)), None);
        assert_eq!(clicked(command(0, 2)), None);
        assert_eq!(clicked(command(1, 2)), None);
    }

    #[test]
    fn icons_are_made_for_both_themes() {
        for ink in [LIGHT_INK, DARK_INK] {
            let icons = Icons::new(ink).unwrap();
            assert_ne!(icons.get(Glyph::Play), icons.get(Glyph::Pause));
        }
    }

    #[test]
    fn mask_rows_are_whole_words() {
        assert_eq!(mask_row(16), 2);
        assert_eq!(mask_row(20), 4);
        assert_eq!(mask_row(32), 4);
    }
}

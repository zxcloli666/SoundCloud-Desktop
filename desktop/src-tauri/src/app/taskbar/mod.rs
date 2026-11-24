#[cfg(any(windows, test))]
mod button;
#[cfg(any(windows, test))]
mod glyph;
#[cfg(windows)]
mod toolbar;

#[cfg(windows)]
pub use self::toolbar::{attach, refresh_labels, set_playing};

#[cfg(not(windows))]
pub fn attach(_app: &crate::rt::App) {}

#[cfg(not(windows))]
pub fn refresh_labels(_app: &crate::rt::AppHandle) {}

#[cfg(not(windows))]
pub fn set_playing(_app: &crate::rt::AppHandle, _playing: bool) {}

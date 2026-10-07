pub mod autostart;
pub mod close_action;
pub mod diagnostics;
pub mod hotkeys;
pub mod log_sink;
pub mod popover;
pub mod popover_position;
pub mod render_mode;
pub mod tray;
pub mod updater;
pub mod visibility;
#[cfg(all(windows, not(feature = "cef")))]
pub mod webview2;

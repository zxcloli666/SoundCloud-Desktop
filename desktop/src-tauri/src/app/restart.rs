use crate::app::{autostart, render_mode};
use crate::rt::AppHandle;

pub fn restart(app: &AppHandle) {
    render_mode::restore_launch_env();
    autostart::mark_user_restart();
    app.request_restart();
}

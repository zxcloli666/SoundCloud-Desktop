use std::path::Path;

use backend_contracts::diag::App;

use super::app_info::{self};
use super::{errors, panic, queue, session};

pub fn run(data_dir: &Path, version: &str, install: String) {
    session::start();
    app_info::set(App {
        version: version.to_string(),
        os: std::env::consts::OS.to_string(),
        os_version: app_info::os_version(),
        arch: std::env::consts::ARCH.to_string(),
        install,
        locale: String::new(),
        id: app_info::install_id(data_dir),
    });
    panic::set_dir(data_dir.to_path_buf());
    queue::start(data_dir);
    if let Some(entry) = panic::take(data_dir) {
        errors::record(entry.clone());
        queue::push(entry);
    }
}

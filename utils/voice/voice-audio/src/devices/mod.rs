#[cfg(not(target_os = "macos"))]
mod cpal_list;
#[cfg(target_os = "macos")]
mod mac;
pub mod pulse;
pub mod transport;
mod watch;

use crate::device::DeviceList;

pub use watch::Watcher;

pub fn list() -> DeviceList {
    #[cfg(target_os = "linux")]
    if let Some(found) = pulse::list() {
        return found;
    }
    #[cfg(target_os = "macos")]
    return mac::list();
    #[cfg(not(target_os = "macos"))]
    cpal_list::list()
}

pub fn watch(interval: std::time::Duration) -> Watcher {
    Watcher::start(interval, list)
}

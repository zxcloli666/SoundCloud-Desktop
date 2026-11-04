use std::collections::HashMap;
use std::sync::OnceLock;

use tauri::Manager;
use tokio::sync::watch;
use zbus::zvariant::Value;

use super::desktop_entry;
use crate::chat::state::ChatState;
use crate::rt::AppHandle;

const PATH: &str = "/com/canonical/unity/launcherentry/soundcloud";
const INTERFACE: &str = "com.canonical.Unity.LauncherEntry";

static COUNTS: OnceLock<watch::Sender<u32>> = OnceLock::new();

pub fn update(app: &AppHandle, count: u32) {
    let Some(state) = app.try_state::<ChatState>() else {
        return;
    };
    let counts = COUNTS.get_or_init(|| {
        let (counts, changes) = watch::channel(0);
        state.rt.spawn(publish(app_uri(app), changes));
        counts
    });
    counts.send_replace(count);
}

fn app_uri(app: &AppHandle) -> String {
    desktop_entry::app_uri(
        std::env::var("FLATPAK_ID").ok().as_deref(),
        std::env::var("GIO_LAUNCHED_DESKTOP_FILE").ok().as_deref(),
        &app.package_info().name,
    )
}

async fn publish(uri: String, mut changes: watch::Receiver<u32>) {
    let Ok(connection) = zbus::Connection::session().await else {
        return;
    };
    while changes.changed().await.is_ok() {
        let count = *changes.borrow_and_update();
        let _ = signal(&connection, &uri, count).await;
    }
}

async fn signal(connection: &zbus::Connection, uri: &str, count: u32) -> zbus::Result<()> {
    let properties = HashMap::from([
        ("count", Value::from(i64::from(count))),
        ("count-visible", Value::from(count > 0)),
    ]);
    connection
        .emit_signal(None::<&str>, PATH, INTERFACE, "Update", &(uri, properties))
        .await
}

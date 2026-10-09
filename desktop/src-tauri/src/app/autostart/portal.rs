use std::collections::HashMap;
use std::path::Path;
use std::time::Duration;

use futures_util::StreamExt;
use zbus::zvariant::{OwnedValue, Value};
use zbus::{Connection, Proxy};

use super::LOGIN_ARG;

const DESTINATION: &str = "org.freedesktop.portal.Desktop";
const OBJECT_PATH: &str = "/org/freedesktop/portal/desktop";
const BACKGROUND: &str = "org.freedesktop.portal.Background";
const REQUEST: &str = "org.freedesktop.portal.Request";
const COMMAND: &str = "soundcloud-desktop";
const RESPONSE_TIMEOUT: Duration = Duration::from_secs(120);

pub fn is_sandboxed() -> bool {
    Path::new("/.flatpak-info").exists()
}

pub async fn request_autostart(enabled: bool, reason: &str) -> Result<bool, String> {
    tokio::time::timeout(RESPONSE_TIMEOUT, request_background(enabled, reason))
        .await
        .map_err(|_| "background portal did not answer".to_string())?
}

async fn request_background(enabled: bool, reason: &str) -> Result<bool, String> {
    let connection = Connection::session().await.map_err(|e| e.to_string())?;
    let sender = connection
        .unique_name()
        .ok_or("session bus gave no unique name")?
        .trim_start_matches(':')
        .replace('.', "_");
    let token = format!("scd_{}", uuid::Uuid::new_v4().simple());
    let request_path = format!("{OBJECT_PATH}/request/{sender}/{token}");
    let request = Proxy::new(&connection, DESTINATION, request_path, REQUEST)
        .await
        .map_err(|e| e.to_string())?;
    let mut responses = request
        .receive_signal("Response")
        .await
        .map_err(|e| e.to_string())?;

    let options = HashMap::from([
        ("handle_token", Value::from(token.as_str())),
        ("reason", Value::from(reason)),
        ("autostart", Value::from(enabled)),
        ("commandline", Value::from(vec![COMMAND, LOGIN_ARG])),
        ("dbus-activatable", Value::from(false)),
    ]);
    connection
        .call_method(
            Some(DESTINATION),
            OBJECT_PATH,
            Some(BACKGROUND),
            "RequestBackground",
            &("", options),
        )
        .await
        .map_err(|e| e.to_string())?;

    let response = responses
        .next()
        .await
        .ok_or("background portal closed the request")?;
    let (code, results): (u32, HashMap<String, OwnedValue>) =
        response.body().deserialize().map_err(|e| e.to_string())?;
    if code != 0 {
        return Err("background permission was denied".into());
    }
    Ok(results
        .get("autostart")
        .and_then(|value| bool::try_from(value).ok())
        .unwrap_or(false))
}

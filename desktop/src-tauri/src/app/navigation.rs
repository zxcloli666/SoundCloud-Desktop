use std::sync::atomic::{AtomicBool, Ordering};

use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime, Url, Webview};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_opener::OpenerExt;

use crate::app::diagnostics;

#[cfg(windows)]
const APP_ORIGIN: (&str, &str) = ("http", "tauri.localhost");
#[cfg(not(windows))]
const APP_ORIGIN: (&str, &str) = ("tauri", "localhost");
const OVERLAY_HOST: &str = "127.0.0.1";
const OVERLAY_PATH: &str = "/overlay";
const BROWSER_SCHEMES: [&str; 4] = ["http", "https", "mailto", "tel"];
const SETTINGS_FILE: &str = "sc-settings.json";
const TITLE: &str = "SoundCloud Desktop";

static ASKING: AtomicBool = AtomicBool::new(false);

pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    let builder = Builder::new("navigation").on_navigation(|webview, url| {
        if allowed(url, dev_server(webview).as_ref()) {
            return true;
        }
        diagnostics::warn(format!(
            "[Navigation] blocked {}://{}",
            url.scheme(),
            url.host_str().unwrap_or_default()
        ));
        offer_browser(webview.app_handle(), url);
        false
    });
    #[cfg(dev)]
    let builder =
        builder.setup(|app, _| Ok(app.add_capability(include_str!("../../dev/remote.json"))?));
    builder.build()
}

fn allowed(url: &Url, dev_server: Option<&Url>) -> bool {
    is_app(url)
        || is_blank(url)
        || is_obs_overlay(url)
        || dev_server.is_some_and(|dev| url.origin() == dev.origin())
}

fn is_app(url: &Url) -> bool {
    url.scheme() == APP_ORIGIN.0 && url.host_str() == Some(APP_ORIGIN.1) && url.port().is_none()
}

fn is_blank(url: &Url) -> bool {
    url.scheme() == "about" && matches!(url.path(), "blank" | "srcdoc")
}

fn is_obs_overlay(url: &Url) -> bool {
    url.scheme() == "http" && url.host_str() == Some(OVERLAY_HOST) && url.path() == OVERLAY_PATH
}

fn dev_server<R: Runtime>(webview: &Webview<R>) -> Option<Url> {
    cfg!(dev)
        .then(|| webview.config().build.dev_url.clone())
        .flatten()
}

fn opens_in_browser(url: &Url) -> bool {
    BROWSER_SCHEMES.contains(&url.scheme())
}

fn offer_browser<R: Runtime>(app: &AppHandle<R>, url: &Url) {
    if !opens_in_browser(url) || ASKING.swap(true, Ordering::AcqRel) {
        return;
    }
    let target = url.to_string();
    let question = question(&language(app));
    let opener = app.clone();
    app.dialog()
        .message(format!("{question}\n\n{target}"))
        .title(TITLE)
        .buttons(MessageDialogButtons::OkCancel)
        .show(move |open| {
            ASKING.store(false, Ordering::Release);
            if open {
                let _ = opener.opener().open_url(target, None::<&str>);
            }
        });
}

fn language<R: Runtime>(app: &AppHandle<R>) -> String {
    app.path()
        .app_data_dir()
        .ok()
        .and_then(|dir| std::fs::read(dir.join(SETTINGS_FILE)).ok())
        .and_then(|raw| serde_json::from_slice::<serde_json::Value>(&raw).ok())
        .and_then(|settings| settings["state"]["language"].as_str().map(str::to_string))
        .unwrap_or_default()
}

fn question(language: &str) -> &'static str {
    match language {
        "ru" => "Открыть ссылку в браузере?",
        "tr" => "Bu bağlantı tarayıcıda açılsın mı?",
        "ko" => "이 링크를 브라우저에서 열까요?",
        _ => "Open this link in your browser?",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(raw: &str) -> Url {
        Url::parse(raw).unwrap()
    }

    fn app_url(path: &str) -> Url {
        url(&format!("{}://{}{path}", APP_ORIGIN.0, APP_ORIGIN.1))
    }

    #[test]
    fn the_app_origin_and_blank_frames_stay_in_the_window() {
        for kept in [
            app_url("/"),
            app_url("/home"),
            app_url("/tray.html"),
            url("about:blank"),
            url("about:srcdoc"),
        ] {
            assert!(allowed(&kept, None), "{kept}");
        }
    }

    #[test]
    fn the_obs_overlay_frame_is_the_only_loopback_page() {
        assert!(allowed(
            &url("http://127.0.0.1:4455/overlay?theme=glass"),
            None
        ));
        for blocked in [
            "http://127.0.0.1:51234/x.svg",
            "http://127.0.0.1:51234/css-assets/x.svg",
            "http://127.0.0.1:51234/overlay/x.svg",
            "https://127.0.0.1:4455/overlay",
            "http://localhost:4455/overlay",
            "http://scproxy-3.localhost:51235/img/abc",
            "scproxy://localhost/abc",
        ] {
            assert!(!allowed(&url(blocked), None), "{blocked}");
        }
    }

    #[test]
    fn other_origins_and_schemes_leave_the_window() {
        let other_runtime = if APP_ORIGIN.0 == "tauri" {
            "http://tauri.localhost/"
        } else {
            "tauri://localhost/"
        };
        for blocked in [
            other_runtime,
            "https://tauri.localhost/",
            "http://tauri.localhost:8080/",
            "https://soundcloud.com/discover",
            "https://api.scnative.dev/health",
            "data:text/html,<p>x</p>",
            "file:///etc/passwd",
            "blob:https://evil.example/1",
        ] {
            assert!(!allowed(&url(blocked), None), "{blocked}");
        }
    }

    #[test]
    fn the_dev_server_counts_only_when_given() {
        let dev = url("http://localhost:1420");
        assert!(allowed(&url("http://localhost:1420/home"), Some(&dev)));
        assert!(!allowed(&url("http://localhost:1421/"), Some(&dev)));
        assert!(!allowed(&url("http://localhost:1420/home"), None));
    }

    #[test]
    fn only_web_and_contact_links_are_offered_to_the_browser() {
        for offered in [
            "https://boosty.to/x",
            "http://example.com",
            "mailto:a@b.c",
            "tel:+100",
        ] {
            assert!(opens_in_browser(&url(offered)), "{offered}");
        }
        for refused in [
            "file:///etc/passwd",
            "data:text/plain,x",
            "scproxy://localhost/x",
            "javascript:alert(1)",
        ] {
            assert!(!opens_in_browser(&url(refused)), "{refused}");
        }
    }

    #[test]
    fn the_dev_capability_grants_what_the_window_gets() {
        let raw = include_str!("../../dev/remote.json");
        let dev: serde_json::Value = serde_json::from_str(raw).unwrap();
        let window: serde_json::Value =
            serde_json::from_str(include_str!("../../capabilities/default.json")).unwrap();
        assert_eq!(dev["permissions"], window["permissions"]);
        assert_eq!(dev["windows"], window["windows"]);
        assert!(window.get("remote").is_none());
        assert!(
            raw.parse::<tauri::utils::acl::capability::CapabilityFile>()
                .is_ok()
        );
    }

    #[test]
    fn the_app_data_root_can_be_made_but_never_removed_whole() {
        let window: serde_json::Value =
            serde_json::from_str(include_str!("../../capabilities/default.json")).unwrap();
        let root = serde_json::json!({ "path": "$APPDATA" });
        let holders: Vec<&str> = window["permissions"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|permission| {
                permission["allow"]
                    .as_array()
                    .is_some_and(|allow| allow.contains(&root))
            })
            .filter_map(|permission| permission["identifier"].as_str())
            .collect();
        assert_eq!(holders, ["fs:allow-mkdir"]);
    }

    #[test]
    fn the_question_follows_the_app_language() {
        assert_eq!(question("ru"), "Открыть ссылку в браузере?");
        assert_eq!(question("ko"), "이 링크를 브라우저에서 열까요?");
        assert_eq!(question(""), "Open this link in your browser?");
    }
}

use std::sync::{Arc, Mutex};

use boosty_card::{Confirmed, acceptable_page};
use tauri::{Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tokio::sync::oneshot;

use crate::app::diagnostics;
use crate::rt::{AppHandle, WebviewWindow};

pub const LABEL: &str = "boosty-3ds";
const TITLE: &str = "SoundCloud Desktop";
const RESULT_HOST: &str = "pay.boosty.to";
const RESULT_PATH: &str = "/app/payment/result";
const SIZE: (f64, f64) = (480.0, 760.0);
const MIN_SIZE: (f64, f64) = (360.0, 520.0);

struct Open(WebviewWindow);

impl Drop for Open {
    fn drop(&mut self) {
        let _ = self.0.destroy();
    }
}

pub async fn confirm(app: AppHandle, url: String) -> Confirmed {
    let Ok(page) = Url::parse(&url) else {
        return Confirmed::Closed;
    };
    if let Some(old) = app.get_webview_window(LABEL) {
        let _ = old.destroy();
    }
    let (end, ended) = oneshot::channel();
    let end = Arc::new(Mutex::new(Some(end)));
    let finish = move |how: Confirmed| {
        if let Some(end) = end.lock().ok().and_then(|mut slot| slot.take()) {
            let _ = end.send(how);
        }
    };
    let on_page = finish.clone();
    let built = WebviewWindowBuilder::new(&app, LABEL, WebviewUrl::External(page))
        .title(TITLE)
        .inner_size(SIZE.0, SIZE.1)
        .min_inner_size(MIN_SIZE.0, MIN_SIZE.1)
        .center()
        .incognito(true)
        .on_navigation(move |next| match result_of(next) {
            Some(how) => {
                on_page(how);
                false
            }
            None => stays_here(next),
        })
        .build();
    let window = match built {
        Ok(window) => Open(window),
        Err(error) => {
            diagnostics::warn(format!("[BoostyCard] 3ds window failed: {error}"));
            return Confirmed::Closed;
        }
    };
    window.0.on_window_event(move |event| {
        if matches!(
            event,
            WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed
        ) {
            finish(Confirmed::Closed);
        }
    });
    ended.await.unwrap_or(Confirmed::Closed)
}

fn result_of(url: &Url) -> Option<Confirmed> {
    let ours = url.scheme() == "https"
        && url.host_str() == Some(RESULT_HOST)
        && url.path().trim_end_matches('/') == RESULT_PATH;
    if !ours {
        return None;
    }
    let success = url
        .query_pairs()
        .any(|(key, value)| key == "result" && value == "success");
    Some(if success {
        Confirmed::Success
    } else {
        Confirmed::Failure
    })
}

fn stays_here(url: &Url) -> bool {
    url.scheme() == "about" || acceptable_page(url.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(raw: &str) -> Url {
        Url::parse(raw).unwrap()
    }

    #[test]
    fn the_result_page_ends_the_window_with_its_verdict() {
        let done = |raw| result_of(&url(raw));
        assert_eq!(
            done("https://pay.boosty.to/app/payment/result?result=success"),
            Some(Confirmed::Success)
        );
        assert_eq!(
            done("https://pay.boosty.to/app/payment/result?result=fail&x=1"),
            Some(Confirmed::Failure)
        );
        assert_eq!(
            done("https://pay.boosty.to/app/payment/result"),
            Some(Confirmed::Failure)
        );
        assert_eq!(
            done("https://pay.boosty.to/app/payment/result/?result=success"),
            Some(Confirmed::Success)
        );
    }

    #[test]
    fn lookalike_pages_do_not_end_it() {
        for raw in [
            "https://pay.boosty.to/app/payment/other?result=success",
            "https://pay.boosty.to.evil.example/app/payment/result?result=success",
            "https://evil.example/app/payment/result?result=success",
            "http://pay.boosty.to/app/payment/result?result=success",
            "https://acs.payeko.ru/?next=https://pay.boosty.to/app/payment/result",
        ] {
            assert_eq!(result_of(&url(raw)), None, "{raw}");
        }
    }

    #[test]
    fn the_window_stays_on_https_bank_pages() {
        assert!(stays_here(&url("https://acs.payeko.ru/3ds")));
        assert!(stays_here(&url("about:blank")));
        for raw in [
            "http://acs.payeko.ru/",
            "https://127.0.0.1/",
            "data:text/html,x",
            "file:///etc/passwd",
            "tauri://localhost/",
        ] {
            assert!(!stays_here(&url(raw)), "{raw}");
        }
    }
}

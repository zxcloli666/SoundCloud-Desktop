use std::sync::{Arc, Mutex};

use pay_card::{PageEnd, Session, acceptable_page};
use tauri::{Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tokio::sync::oneshot;

use crate::app::diagnostics;
use crate::rt::{AppHandle, WebviewWindow};

pub const LABEL: &str = "pay-page";
const TITLE: &str = "SoundCloud Desktop";
const SIZE: (f64, f64) = (480.0, 760.0);
const MIN_SIZE: (f64, f64) = (360.0, 520.0);

struct Open(WebviewWindow);

impl Drop for Open {
    fn drop(&mut self) {
        let _ = self.0.destroy();
    }
}

pub async fn show(app: AppHandle, session: Session, url: String) -> PageEnd {
    let Ok(page) = Url::parse(&url) else {
        return PageEnd::Closed;
    };
    if let Some(old) = app.get_webview_window(LABEL) {
        let _ = old.destroy();
    }
    let (end, ended) = oneshot::channel();
    let end = Arc::new(Mutex::new(Some(end)));
    let finish = move |how: PageEnd| {
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
        .on_navigation(move |next| {
            if session.ends_at(next.as_str()) {
                on_page(PageEnd::Reached(next.to_string()));
                return false;
            }
            stays_here(next)
        })
        .build();
    let window = match built {
        Ok(window) => Open(window),
        Err(error) => {
            diagnostics::warn(format!("[PayCard] page window failed: {error}"));
            return PageEnd::Closed;
        }
    };
    window.0.on_window_event(move |event| {
        if matches!(
            event,
            WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed
        ) {
            finish(PageEnd::Closed);
        }
    });
    ended.await.unwrap_or(PageEnd::Closed)
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
    fn the_window_stays_on_https_pages() {
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

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD as BASE64_URL};

use crate::network::edge;

const DEBUG_WINDOW_MS: u64 = 10 * 60 * 1000;

static DEBUG_UNTIL_MS: AtomicU64 = AtomicU64::new(0);

tokio::task_local! {
    static CURRENT: String;
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_millis() as u64)
}

pub fn new_trace() -> String {
    uuid::Uuid::new_v4().simple().to_string()
}

pub fn new_span() -> String {
    uuid::Uuid::new_v4().simple().to_string()[..16].to_string()
}

pub fn valid_trace(text: &str) -> bool {
    text.len() == 32
        && text
            .bytes()
            .all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'))
}

pub fn current() -> String {
    CURRENT
        .try_with(String::clone)
        .unwrap_or_else(|_| new_trace())
}

pub async fn within<F: Future>(trace: String, work: F) -> F::Output {
    CURRENT.scope(trace, work).await
}

pub fn open_debug() {
    DEBUG_UNTIL_MS.store(now_ms() + DEBUG_WINDOW_MS, Ordering::Relaxed);
}

pub fn debug_active() -> bool {
    now_ms() < DEBUG_UNTIL_MS.load(Ordering::Relaxed)
}

pub struct Resolved {
    pub host: String,
    pub path: String,
    pub pro: Option<String>,
}

pub fn resolve(url: &str) -> Option<Resolved> {
    let parsed = url::Url::parse(url).ok()?;
    let host = parsed.host_str()?.to_ascii_lowercase();
    if host == "127.0.0.1"
        && let Some(rest) = parsed.path().strip_prefix("/pro/")
    {
        let (pro, encoded) = rest.split_once('/')?;
        let inner = BASE64_URL.decode(encoded.as_bytes()).ok()?;
        let mut resolved = resolve(&String::from_utf8(inner).ok()?)?;
        resolved.pro = Some(pro.to_ascii_lowercase());
        return Some(resolved);
    }
    let mut path = parsed.path().to_string();
    if let Some(query) = parsed.query() {
        path.push('?');
        path.push_str(query);
    }
    Some(Resolved {
        host,
        path,
        pro: None,
    })
}

pub fn allowed_host(host: &str) -> bool {
    edge::is_our_host(host) || matches!(edge::key_of_host(host), edge::Key::Service(_))
}

pub fn traceparent(trace: &str, span: &str, debug: bool) -> String {
    let flags = if debug { "01" } else { "00" };
    format!("00-{trace}-{span}-{flags}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_have_the_w3c_sizes() {
        let trace = new_trace();
        assert!(valid_trace(&trace));
        assert_eq!(new_span().len(), 16);
        assert!(!valid_trace("XYZ"));
        assert!(!valid_trace(&trace.to_uppercase()));
    }

    #[test]
    fn traceparent_carries_flags() {
        let header = traceparent(&"a".repeat(32), &"b".repeat(16), true);
        assert_eq!(
            header,
            format!("00-{}-{}-01", "a".repeat(32), "b".repeat(16))
        );
        assert!(traceparent("t", "s", false).ends_with("-00"));
    }

    #[test]
    fn only_our_hosts_are_allowed() {
        let allowed = |url: &str| resolve(url).is_some_and(|found| allowed_host(&found.host));
        for url in [
            "https://api.scnative.dev/me",
            "https://api.r2.relay.scnative.dev/x",
            "https://p1.pro.scnative.dev/x",
            "https://images.scnative.dev/a.jpg",
            "http://api.scdinternal.site:81/",
        ] {
            assert!(allowed(url), "{url}");
        }
        for url in [
            "https://p1.pro.scnative.space/x",
            "https://nats-public.scnative.dev/",
            "https://api-v2.soundcloud.com/tracks",
            "https://i1.sndcdn.com/a.jpg",
            "https://evilscnative.dev/",
            "https://scnative.dev.evil.com/",
            "https://example.com/",
            "not a url",
        ] {
            assert!(!allowed(url), "{url}");
        }
    }

    #[test]
    fn the_pro_gateway_resolves_to_the_inner_target() {
        let inner = BASE64_URL.encode("https://api.scnative.dev/me?x=1");
        let found = resolve(&format!(
            "http://127.0.0.1:5000/pro/p1.pro.scnative.dev/{inner}"
        ))
        .unwrap();
        assert_eq!(found.host, "api.scnative.dev");
        assert_eq!(found.path, "/me?x=1");
        assert_eq!(found.pro.as_deref(), Some("p1.pro.scnative.dev"));
        let other = BASE64_URL.encode("https://api-v2.soundcloud.com/x");
        let found = resolve(&format!(
            "http://127.0.0.1:5000/pro/p1.pro.scnative.dev/{other}"
        ))
        .unwrap();
        assert!(!allowed_host(&found.host));
    }

    #[test]
    fn debug_window_opens() {
        open_debug();
        assert!(debug_active());
    }

    #[tokio::test]
    async fn the_scoped_trace_is_seen_inside() {
        let trace = new_trace();
        let seen = within(trace.clone(), async { current() }).await;
        assert_eq!(seen, trace);
        assert_ne!(current(), trace);
    }
}

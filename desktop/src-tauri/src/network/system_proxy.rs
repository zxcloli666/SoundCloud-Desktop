use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use hyper_util::client::proxy::matcher::Matcher;

const REREAD: Duration = Duration::from_secs(3);

const ENV_PROXIES: &[&str] = &[
    "ALL_PROXY",
    "all_proxy",
    "HTTPS_PROXY",
    "https_proxy",
    "HTTP_PROXY",
    "http_proxy",
];

struct Snapshot {
    matcher: Matcher,
    read_at: Instant,
}

static SNAPSHOT: OnceLock<Mutex<Snapshot>> = OnceLock::new();

pub fn follow(builder: wreq::ClientBuilder) -> wreq::ClientBuilder {
    if env_proxy_set() {
        return builder;
    }
    builder.proxy(wreq::Proxy::custom(|url| current_proxy(url.as_str())))
}

pub fn proxied(url: &str) -> bool {
    current_proxy(url).is_some()
}

fn env_proxy_set() -> bool {
    ENV_PROXIES
        .iter()
        .any(|name| std::env::var_os(name).is_some())
}

fn current_proxy(url: &str) -> Option<String> {
    let mut snapshot = SNAPSHOT
        .get_or_init(|| Mutex::new(read_system()))
        .lock()
        .unwrap_or_else(|poison| poison.into_inner());
    if snapshot.read_at.elapsed() >= REREAD {
        *snapshot = read_system();
    }
    proxy_url(&snapshot.matcher, url)
}

fn read_system() -> Snapshot {
    Snapshot {
        matcher: system_matcher(),
        read_at: Instant::now(),
    }
}

#[cfg(not(windows))]
fn system_matcher() -> Matcher {
    Matcher::from_system()
}

#[cfg(windows)]
fn system_matcher() -> Matcher {
    if env_proxy_set() {
        return Matcher::from_env();
    }
    match internet_settings() {
        Some((server, overrides)) => registry_matcher(&server, &overrides),
        None => Matcher::builder().build(),
    }
}

#[cfg(windows)]
fn internet_settings() -> Option<(String, String)> {
    let settings = windows_registry::CURRENT_USER
        .open("Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings")
        .ok()?;
    if settings.get_u32("ProxyEnable").unwrap_or(0) == 0 {
        return None;
    }
    let server = settings.get_string("ProxyServer").ok()?;
    let overrides = settings.get_string("ProxyOverride").unwrap_or_default();
    Some((server, overrides))
}

#[cfg(any(windows, test))]
fn registry_matcher(server: &str, overrides: &str) -> Matcher {
    let bypass = overrides
        .split(';')
        .map(str::trim)
        .collect::<Vec<_>>()
        .join(",")
        .replace("*.", "");
    let mut builder = Matcher::builder().no(bypass);
    if !server.contains('=') {
        return builder.http(server.trim()).https(server.trim()).build();
    }
    for (scheme, address) in server.split(';').filter_map(|entry| entry.split_once('=')) {
        builder = match scheme.trim() {
            "http" => builder.http(address.trim()),
            "https" => builder.https(address.trim()),
            _ => builder,
        };
    }
    builder.build()
}

fn proxy_url(matcher: &Matcher, url: &str) -> Option<String> {
    let dst = url.parse::<http::Uri>().ok()?;
    matcher.intercept(&dst).map(|proxy| proxy.uri().to_string())
}

#[cfg(test)]
mod tests {
    use hyper_util::client::proxy::matcher::Matcher;
    use warp::Filter;

    use super::{proxy_url, registry_matcher};

    #[test]
    fn the_proxy_the_system_names_is_used_except_for_bypassed_hosts() {
        let matcher = Matcher::builder()
            .all("127.0.0.1:10809")
            .no("localhost,example.org")
            .build();
        assert_eq!(
            proxy_url(&matcher, "https://api.scnative.space/me").as_deref(),
            Some("http://127.0.0.1:10809/")
        );
        assert_eq!(proxy_url(&matcher, "https://example.org/x"), None);
    }

    #[test]
    fn a_socks_proxy_keeps_its_scheme() {
        let matcher = Matcher::builder().all("socks5://127.0.0.1:10808").build();
        assert_eq!(
            proxy_url(&matcher, "https://api.scnative.space/").as_deref(),
            Some("socks5://127.0.0.1:10808/")
        );
    }

    #[test]
    fn a_per_protocol_windows_setting_sends_each_scheme_to_its_own_proxy() {
        let matcher = registry_matcher("http=127.0.0.1:8080;https=127.0.0.1:8081", "");
        assert_eq!(
            proxy_url(&matcher, "https://api.scnative.space/").as_deref(),
            Some("http://127.0.0.1:8081/")
        );
        assert_eq!(
            proxy_url(&matcher, "http://api.scnative.space/").as_deref(),
            Some("http://127.0.0.1:8080/")
        );
    }

    #[test]
    fn a_windows_setting_for_one_scheme_leaves_the_other_direct() {
        let matcher = registry_matcher("https=127.0.0.1:8080", "");
        assert_eq!(
            proxy_url(&matcher, "https://api.scnative.space/").as_deref(),
            Some("http://127.0.0.1:8080/")
        );
        assert_eq!(proxy_url(&matcher, "http://api.scnative.space/"), None);
    }

    #[test]
    fn a_socks_only_windows_setting_means_no_proxy() {
        let matcher = registry_matcher("socks=127.0.0.1:1080", "");
        assert_eq!(proxy_url(&matcher, "https://api.scnative.space/"), None);
    }

    #[test]
    fn a_plain_windows_setting_covers_both_schemes_except_the_overrides() {
        let matcher = registry_matcher("127.0.0.1:10809", "localhost;*.example.org;<local>");
        assert_eq!(
            proxy_url(&matcher, "https://api.scnative.space/").as_deref(),
            Some("http://127.0.0.1:10809/")
        );
        assert_eq!(proxy_url(&matcher, "https://cdn.example.org/x"), None);
    }

    #[tokio::test]
    async fn a_request_goes_through_the_proxy_the_system_names() {
        let local = warp::path("health").map(|| "via proxy");
        let (addr, server) = warp::serve(local).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(server);
        let matcher = Matcher::builder().http(format!("http://{addr}")).build();
        let client = wreq::Client::builder()
            .proxy(wreq::Proxy::custom(move |url| {
                proxy_url(&matcher, url.as_str())
            }))
            .build()
            .unwrap();

        let body = client
            .get("http://api.scnative.space/health")
            .send()
            .await
            .unwrap()
            .text()
            .await
            .unwrap();

        assert_eq!(body, "via proxy");
    }
}

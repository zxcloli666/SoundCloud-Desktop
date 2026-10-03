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
    if ENV_PROXIES.iter().any(|name| std::env::var_os(name).is_some()) {
        return builder;
    }
    builder.proxy(wreq::Proxy::custom(|url| current_proxy(url.as_str())))
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
        matcher: Matcher::from_system(),
        read_at: Instant::now(),
    }
}

fn proxy_url(matcher: &Matcher, url: &str) -> Option<String> {
    let dst = url.parse::<http::Uri>().ok()?;
    matcher
        .intercept(&dst)
        .map(|proxy| proxy.uri().to_string())
}

#[cfg(test)]
mod tests {
    use hyper_util::client::proxy::matcher::Matcher;
    use warp::Filter;

    use super::proxy_url;

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

    #[tokio::test]
    async fn a_request_goes_through_the_proxy_the_system_names() {
        let local = warp::path("health").map(|| "via proxy");
        let (addr, server) = warp::serve(local).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(server);
        let matcher = Matcher::builder().http(format!("http://{addr}")).build();
        let client = wreq::Client::builder()
            .proxy(wreq::Proxy::custom(move |url| proxy_url(&matcher, url.as_str())))
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

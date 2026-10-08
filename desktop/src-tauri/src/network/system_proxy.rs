use std::sync::{Arc, Mutex, OnceLock};
use std::task::{Context, Poll};
use std::time::{Duration, Instant};

use futures_util::future::{Either, Ready, ready};
use http::{Request, Uri};
use hyper_util::client::proxy::matcher::Matcher;
use tower::{Layer, Service};
use wreq::Body;

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

type Lookup = Arc<dyn Fn(&Uri) -> Option<String> + Send + Sync>;

#[derive(Clone)]
struct Route {
    lookup: Lookup,
}

#[derive(Clone)]
struct Routed<S> {
    inner: S,
    lookup: Lookup,
}

static SNAPSHOT: OnceLock<Mutex<Snapshot>> = OnceLock::new();

pub fn follow(builder: wreq::ClientBuilder) -> wreq::ClientBuilder {
    let builder = crate::network::dns::install(builder);
    if env_proxy_set() {
        return builder;
    }
    builder.no_proxy().layer(Route::new(current_proxy))
}

pub fn proxied(url: &str) -> bool {
    url.parse::<Uri>()
        .ok()
        .and_then(|dst| current_proxy(&dst))
        .is_some()
}

pub fn env_proxy_names() -> Vec<String> {
    ENV_PROXIES
        .iter()
        .filter(|name| std::env::var_os(name).is_some())
        .map(|name| name.to_string())
        .collect()
}

fn env_proxy_set() -> bool {
    ENV_PROXIES
        .iter()
        .any(|name| std::env::var_os(name).is_some())
}

fn current_proxy(dst: &Uri) -> Option<String> {
    let mut snapshot = SNAPSHOT
        .get_or_init(|| Mutex::new(read_system()))
        .lock()
        .unwrap_or_else(|poison| poison.into_inner());
    if snapshot.read_at.elapsed() >= REREAD {
        *snapshot = read_system();
    }
    intercept(&snapshot.matcher, dst)
}

impl Route {
    fn new(lookup: impl Fn(&Uri) -> Option<String> + Send + Sync + 'static) -> Self {
        Self {
            lookup: Arc::new(lookup),
        }
    }
}

impl<S> Layer<S> for Route {
    type Service = Routed<S>;

    fn layer(&self, inner: S) -> Routed<S> {
        Routed {
            inner,
            lookup: self.lookup.clone(),
        }
    }
}

impl<S> Service<Request<Body>> for Routed<S>
where
    S: Service<Request<Body>>,
    S::Error: From<wreq::Error>,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = Either<S::Future, Ready<Result<S::Response, S::Error>>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), S::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, request: Request<Body>) -> Self::Future {
        let proxy = (self.lookup)(request.uri()).and_then(|url| wreq::Proxy::all(url).ok());
        let (Some(proxy), Some(carrier)) = (proxy, carrier()) else {
            return Either::Left(self.inner.call(request));
        };
        match wreq::RequestBuilder::from_parts(carrier.clone(), request.into())
            .proxy(proxy)
            .build()
        {
            Ok(routed) => Either::Left(self.inner.call(routed.into())),
            Err(error) => Either::Right(ready(Err(error.into()))),
        }
    }
}

fn carrier() -> Option<&'static wreq::Client> {
    static CARRIER: OnceLock<Option<wreq::Client>> = OnceLock::new();
    CARRIER
        .get_or_init(|| wreq::Client::builder().no_proxy().build().ok())
        .as_ref()
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

fn intercept(matcher: &Matcher, dst: &Uri) -> Option<String> {
    matcher.intercept(dst).map(|proxy| proxy.uri().to_string())
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::sync::atomic::{AtomicBool, Ordering};

    use hyper_util::client::proxy::matcher::Matcher;
    use warp::Filter;

    use super::{Route, intercept, registry_matcher};

    fn proxy_url(matcher: &Matcher, url: &str) -> Option<String> {
        intercept(matcher, &url.parse().unwrap())
    }

    fn serve(reply: &'static str) -> std::net::SocketAddr {
        let route = warp::path("health").map(move || reply);
        let (addr, server) = warp::serve(route).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(server);
        addr
    }

    async fn body_of(client: &wreq::Client, url: &str) -> String {
        client.get(url).send().await.unwrap().text().await.unwrap()
    }

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
        let addr = serve("via proxy");
        let matcher = Matcher::builder().http(format!("http://{addr}")).build();
        let client = wreq::Client::builder()
            .no_proxy()
            .layer(Route::new(move |dst| intercept(&matcher, dst)))
            .build()
            .unwrap();

        let body = body_of(&client, "http://api.scnative.space/health").await;

        assert_eq!(body, "via proxy");
    }

    #[tokio::test]
    async fn a_proxy_switched_on_later_carries_the_next_request() {
        let target = format!("http://{}/health", serve("direct"));
        let proxy = format!("http://{}", serve("via proxy"));
        let on = Arc::new(AtomicBool::new(false));
        let switch = on.clone();
        let client = wreq::Client::builder()
            .no_proxy()
            .layer(Route::new(move |_| {
                switch.load(Ordering::SeqCst).then(|| proxy.clone())
            }))
            .build()
            .unwrap();

        assert_eq!(body_of(&client, &target).await, "direct");
        on.store(true, Ordering::SeqCst);
        assert_eq!(body_of(&client, &target).await, "via proxy");
        on.store(false, Ordering::SeqCst);
        assert_eq!(body_of(&client, &target).await, "direct");
    }
}

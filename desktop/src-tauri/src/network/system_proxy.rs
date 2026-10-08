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
    settings: Option<(String, String)>,
    read_at: Instant,
}

type Lookup = Arc<dyn Fn(&Uri) -> Option<wreq::Proxy> + Send + Sync>;

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
    builder.no_proxy().layer(Route::new(current_route))
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
    intercept(&snapshot().matcher, dst)
}

fn current_route(dst: &Uri) -> Option<wreq::Proxy> {
    let snapshot = snapshot();
    match &snapshot.settings {
        Some((server, overrides)) => registry_proxy(server, overrides, dst),
        None => first_hop(&snapshot.matcher, dst),
    }
}

fn snapshot() -> std::sync::MutexGuard<'static, Snapshot> {
    let mut snapshot = SNAPSHOT
        .get_or_init(|| Mutex::new(read_system()))
        .lock()
        .unwrap_or_else(|poison| poison.into_inner());
    if snapshot.read_at.elapsed() >= REREAD {
        *snapshot = read_system();
    }
    snapshot
}

fn first_hop(matcher: &Matcher, dst: &Uri) -> Option<wreq::Proxy> {
    intercept(matcher, dst).and_then(|url| wreq::Proxy::all(url).ok())
}

impl Route {
    fn new(lookup: impl Fn(&Uri) -> Option<wreq::Proxy> + Send + Sync + 'static) -> Self {
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
        let proxy = (self.lookup)(request.uri());
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

#[cfg(not(windows))]
fn read_system() -> Snapshot {
    Snapshot {
        matcher: Matcher::from_system(),
        settings: None,
        read_at: Instant::now(),
    }
}

#[cfg(windows)]
fn read_system() -> Snapshot {
    let settings = (!env_proxy_set()).then(internet_settings).flatten();
    let matcher = match &settings {
        Some((server, overrides)) => registry_matcher(server, overrides),
        None if env_proxy_set() => Matcher::from_env(),
        None => Matcher::builder().build(),
    };
    Snapshot {
        matcher,
        settings,
        read_at: Instant::now(),
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
    let mut builder = Matcher::builder().no(bypass_list(overrides));
    let (http, https) = registry_servers(server);
    if let Some(http) = http {
        builder = builder.http(http);
    }
    if let Some(https) = https {
        builder = builder.https(https);
    }
    builder.build()
}

fn registry_proxy(server: &str, overrides: &str, dst: &Uri) -> Option<wreq::Proxy> {
    let proxy = match registry_servers(server) {
        (Some(http), Some(https)) if http == https => wreq::Proxy::all(with_scheme(http)),
        (Some(http), Some(_)) if dst.scheme_str() == Some("http") => {
            wreq::Proxy::http(with_scheme(http))
        }
        (_, Some(https)) => wreq::Proxy::https(with_scheme(https)),
        (Some(http), None) => wreq::Proxy::http(with_scheme(http)),
        (None, None) => return None,
    };
    let bypass = wreq::NoProxy::from_string(&bypass_list(overrides));
    proxy.ok().map(|proxy| proxy.no_proxy(bypass))
}

fn registry_servers(server: &str) -> (Option<&str>, Option<&str>) {
    let server = server.trim();
    if server.is_empty() {
        return (None, None);
    }
    if !server.contains('=') {
        return (Some(server), Some(server));
    }
    let mut servers = (None, None);
    for (scheme, address) in server.split(';').filter_map(|entry| entry.split_once('=')) {
        match scheme.trim() {
            "http" => servers.0 = Some(address.trim()),
            "https" => servers.1 = Some(address.trim()),
            _ => {}
        }
    }
    servers
}

fn bypass_list(overrides: &str) -> String {
    overrides
        .split(';')
        .map(str::trim)
        .collect::<Vec<_>>()
        .join(",")
        .replace("*.", "")
}

fn with_scheme(address: &str) -> String {
    if address.contains("://") {
        address.to_string()
    } else {
        format!("http://{address}")
    }
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

    use super::{Route, first_hop, intercept, registry_matcher, registry_proxy};

    fn proxy_url(matcher: &Matcher, url: &str) -> Option<String> {
        intercept(matcher, &url.parse().unwrap())
    }

    fn serve(reply: &'static str) -> std::net::SocketAddr {
        let route = warp::path("health").map(move || reply);
        let (addr, server) = warp::serve(route).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(server);
        addr
    }

    fn serve_redirect(reply: &'static str, location: String) -> std::net::SocketAddr {
        let start = warp::path("start").map(move || {
            warp::reply::with_header(
                warp::reply::with_status(reply, warp::http::StatusCode::FOUND),
                "location",
                location.clone(),
            )
        });
        let health = warp::path("health").map(move || reply);
        let (addr, server) = warp::serve(start.or(health)).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(server);
        addr
    }

    fn registry_client(server: String, overrides: &'static str) -> wreq::Client {
        wreq::Client::builder()
            .no_proxy()
            .redirect(wreq::redirect::Policy::limited(5))
            .layer(Route::new(move |dst| {
                registry_proxy(&server, overrides, dst)
            }))
            .build()
            .unwrap()
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
            .layer(Route::new(move |dst| first_hop(&matcher, dst)))
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
                switch
                    .load(Ordering::SeqCst)
                    .then(|| wreq::Proxy::all(proxy.as_str()).unwrap())
            }))
            .build()
            .unwrap();

        assert_eq!(body_of(&client, &target).await, "direct");
        on.store(true, Ordering::SeqCst);
        assert_eq!(body_of(&client, &target).await, "via proxy");
        on.store(false, Ordering::SeqCst);
        assert_eq!(body_of(&client, &target).await, "direct");
    }

    #[tokio::test]
    async fn a_bypassed_host_redirecting_to_a_proxied_one_takes_the_proxy_on_that_hop() {
        let proxy = serve("via proxy");
        let first = serve_redirect("bypassed", "http://api.scnative.space/health".into());
        let client = registry_client(proxy.to_string(), "localhost");

        let body = body_of(&client, &format!("http://localhost:{}/start", first.port())).await;

        assert_eq!(body, "via proxy");
    }

    #[tokio::test]
    async fn a_proxied_host_redirecting_to_a_bypassed_one_goes_direct_on_that_hop() {
        let direct = serve("direct");
        let proxy = serve_redirect(
            "via proxy",
            format!("http://localhost:{}/health", direct.port()),
        );
        let client = registry_client(proxy.to_string(), "localhost");

        let body = body_of(&client, "http://api.scnative.space/start").await;

        assert_eq!(body, "direct");
    }

    #[tokio::test]
    async fn a_per_protocol_setting_proxies_the_scheme_of_the_first_hop() {
        let http = serve("via http proxy");
        let client = registry_client(format!("http={http};https=127.0.0.1:9"), "");

        let body = body_of(&client, "http://api.scnative.space/health").await;

        assert_eq!(body, "via http proxy");
    }
}

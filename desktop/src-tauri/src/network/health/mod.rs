mod delivery;
mod discovery;
pub(crate) mod link;
mod model;
mod net_watch;
mod probe;
mod rounds;

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tokio::runtime::Handle;
use tokio::sync::Notify;
use uuid::Uuid;
use wreq::tls::TlsOptions;

use self::delivery::Delivery;
use self::model::Topology;
use self::probe::{EndToEnd, Pool};
use crate::network::edge;
use crate::app::diagnostics::log_native;

const IDENTITY_FILE: &str = "health_identity.json";

#[derive(Deserialize, Serialize)]
struct Identity {
    client_id: String,
}

struct Agent {
    app: crate::rt::AppHandle,
    app_version: String,
    client_id: String,
    delivery: Delivery,
    probe_client: wreq::Client,
    nudge: Arc<Notify>,
}

pub fn start(data_dir: PathBuf, app: crate::rt::AppHandle, runtime: Handle) {
    let app_version = env!("CARGO_PKG_VERSION").to_string();
    let client_id = load_or_create_identity(&data_dir);
    let (client, probe_client) = match (
        builder(&app_version).build(),
        probe_builder(&app_version).build(),
    ) {
        (Ok(client), Ok(probe_client)) => (client, probe_client),
        (Err(error), _) | (_, Err(error)) => {
            log_native(
                &app,
                "WARN",
                format!("[Health] disabled: client init failed: {error}"),
            );
            return;
        }
    };

    let agent = Agent {
        app,
        app_version,
        client_id,
        delivery: Delivery::new(client),
        probe_client,
        nudge: Arc::new(Notify::new()),
    };
    runtime.spawn(agent.run());
}

fn builder(app_version: &str) -> wreq::ClientBuilder {
    crate::network::dns::install(wreq::Client::builder())
        .no_proxy()
        .user_agent(format!("soundcloud-desktop-health/{app_version}"))
        .connect_timeout(Duration::from_secs(3))
        .tls_options(TlsOptions::builder().pre_shared_key(true).build())
}

// Счётчик объёма у DPI живёт на TCP-сессии: переиспользованная приходит к
// пробе уже за порогом, и тогда любой замер показывает вмешательство.
fn probe_builder(app_version: &str) -> wreq::ClientBuilder {
    builder(app_version).pool_max_idle_per_host(0)
}

impl Agent {
    async fn run(self) {
        let watcher_nudge = self.nudge.clone();
        tokio::spawn(net_watch::run(watcher_nudge));

        let mut topology = Topology::bootstrap();
        let mut round = 0usize;
        let mut last_paths = Vec::new();
        let mut last_lost = Vec::new();
        let mut end_to_end = EndToEnd::new();
        loop {
            let started = Instant::now();
            round = round.wrapping_add(1);
            if let Some(fresh) = self.delivery.fetch_topology(&topology).await {
                edge::set_relay_only(fresh.relay_only_labels());
                topology = fresh;
            }

            let pool = Pool {
                relays: discovery::relays(&topology.relays).await,
                calls: discovery::calls(&topology.call_nodes()).await,
            };
            edge::set_pool(
                probe::reaching_main_first(
                    probe::usable_first(&pool.relays, &last_paths, &end_to_end),
                    &last_lost,
                ),
                topology.weighted_calls(&pool.calls),
            );
            edge::announce(&self.app);

            let pros = discovery::pros(&topology.pros).await;
            edge::set_pros(pros.clone());
            let (mut paths, lost, probed) = tokio::join!(
                probe::probe_paths(
                    &self.probe_client,
                    &pool,
                    round,
                    !edge::is_relay_only("api")
                ),
                probe::main_lost(&self.probe_client, &pool.relays),
                probe::probe_end_to_end(&self.probe_client, &pool.relays, round)
            );
            if let Some((node, usable)) = probed {
                end_to_end.insert(node, usable);
            }
            edge::set_pool(
                probe::reaching_main_first(
                    probe::usable_first(&pool.relays, &paths, &end_to_end),
                    &lost,
                ),
                Vec::new(),
            );
            let relays_lag = probe::relays_lag(&pool.relays, &paths);
            let pro_paths = probe::probe_pros(&pros, probe::pro_needed(&pool.relays, &paths)).await;
            edge::set_pros(probe::usable_first(&pros, &pro_paths, &EndToEnd::new()));
            if relays_lag && pro_paths.iter().any(|sample| sample.ok) {
                edge::escalate_relayed();
            }
            paths.extend(pro_paths);
            let cut = probe::note_direct_cut(&paths);
            let early = self
                .delivery
                .report(&topology, &self.client_id, &self.app_version, &paths)
                .await;

            let services = probe::probe_services(
                &self.probe_client,
                &topology,
                &pool,
                probe::direct_bytes(&paths),
            )
            .await;
            edge::announce(&self.app);
            let late = self
                .delivery
                .report(&topology, &self.client_id, &self.app_version, &services)
                .await;

            let delivered = early || late;
            let ok = services.iter().filter(|sample| sample.ok).count();
            if cut || (!services.is_empty() && ok == 0) {
                crate::network::netcheck::auto("health");
            }
            log_native(
                &self.app,
                if delivered { "INFO" } else { "WARN" },
                format!(
                    "[Health] topology={} relays={} calls={} samples={} reachable={} e2e={} delivered={} elapsed={}ms",
                    topology.version,
                    pool.relays.len(),
                    pool.calls.len(),
                    paths.len() + services.len(),
                    ok,
                    probe::end_to_end_line(&end_to_end),
                    delivered,
                    started.elapsed().as_millis()
                ),
            );
            let relays_down = probe::relays_down(&pool.relays, &paths);
            last_paths = paths;
            last_lost = lost;

            let interval = Duration::from_secs(topology.probe_interval_secs.max(30));
            rounds::wait(&self.nudge, interval, relays_down).await;
        }
    }
}

fn load_or_create_identity(data_dir: &Path) -> String {
    let path = data_dir.join(IDENTITY_FILE);
    if let Ok(raw) = std::fs::read(&path)
        && let Ok(identity) = serde_json::from_slice::<Identity>(&raw) {
            let id = identity.client_id.trim();
            if !id.is_empty() && id.len() <= 64 {
                return id.to_string();
            }
        }

    let client_id = format!("tauri-{}", Uuid::new_v4());
    if let Ok(raw) = serde_json::to_vec(&Identity {
        client_id: client_id.clone(),
    }) {
        let temp = path.with_extension("tmp");
        if std::fs::write(&temp, raw).is_ok()
            && std::fs::rename(&temp, &path).is_err() {
                let _ = std::fs::remove_file(temp);
            }
    }
    client_id
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use rustls::HandshakeKind;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    use super::{builder, load_or_create_identity, probe_builder};
    use crate::network::h2_server::acceptor;

    async fn tls_server() -> (String, Arc<Mutex<Vec<HandshakeKind>>>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let handshakes = Arc::new(Mutex::new(Vec::new()));
        let seen = handshakes.clone();
        let acceptor = acceptor(&[b"http/1.1"]);
        tokio::spawn(async move {
            while let Ok((socket, _)) = listener.accept().await {
                let Ok(mut stream) = acceptor.accept(socket).await else {
                    continue;
                };
                if let Some(kind) = stream.get_ref().1.handshake_kind() {
                    seen.lock().unwrap().push(kind);
                }
                tokio::spawn(async move {
                    let mut request = [0u8; 1024];
                    while stream.read(&mut request).await.is_ok_and(|read| read > 0) {
                        let answer = b"HTTP/1.1 200 OK\r\ncontent-length: 2\r\n\r\nok";
                        if stream.write_all(answer).await.is_err() {
                            return;
                        }
                    }
                });
            }
        });
        (format!("https://{addr}/probe"), handshakes)
    }

    async fn probe_three_times(client: &wreq::Client, url: &str) {
        for _ in 0..3 {
            let body = client.get(url).send().await.unwrap().text().await.unwrap();
            assert_eq!(body, "ok");
        }
    }

    #[tokio::test]
    async fn every_probe_opens_its_own_connection_and_resumes_tls() {
        let (url, handshakes) = tls_server().await;
        let client = probe_builder("test")
            .tls_cert_verification(false)
            .build()
            .unwrap();
        probe_three_times(&client, &url).await;
        assert_eq!(
            *handshakes.lock().unwrap(),
            [
                HandshakeKind::Full,
                HandshakeKind::Resumed,
                HandshakeKind::Resumed
            ]
        );
    }

    #[tokio::test]
    async fn the_delivery_client_keeps_one_connection() {
        let (url, handshakes) = tls_server().await;
        let client = builder("test")
            .tls_cert_verification(false)
            .build()
            .unwrap();
        probe_three_times(&client, &url).await;
        assert_eq!(*handshakes.lock().unwrap(), [HandshakeKind::Full]);
    }

    #[tokio::test]
    async fn without_the_session_cache_every_probe_pays_a_full_handshake() {
        let (url, handshakes) = tls_server().await;
        let client = wreq::Client::builder()
            .no_proxy()
            .pool_max_idle_per_host(0)
            .tls_cert_verification(false)
            .build()
            .unwrap();
        probe_three_times(&client, &url).await;
        assert_eq!(
            *handshakes.lock().unwrap(),
            [
                HandshakeKind::Full,
                HandshakeKind::Full,
                HandshakeKind::Full
            ]
        );
    }

    #[test]
    fn identity_is_stable_and_anonymous() {
        let dir = std::env::temp_dir().join(format!("sc-health-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let first = load_or_create_identity(&dir);
        let second = load_or_create_identity(&dir);
        assert_eq!(first, second);
        assert!(first.starts_with("tauri-"));
        assert!(first.len() <= 64);
        std::fs::remove_dir_all(dir).unwrap();
    }
}

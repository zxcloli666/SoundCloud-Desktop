mod delivery;
mod discovery;
mod link;
mod model;
mod net_watch;
mod probe;

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tokio::runtime::Handle;
use tokio::sync::Notify;
use uuid::Uuid;

use self::delivery::Delivery;
use self::model::Topology;
use self::probe::Pool;
use crate::network::edge;
use crate::app::diagnostics::log_native;

const IDENTITY_FILE: &str = "health_identity.json";
const MIN_ROUND_GAP: Duration = Duration::from_secs(15);

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
    let build = |pooled: bool| {
        let builder = wreq::Client::builder()
            .no_proxy()
            .user_agent(format!("soundcloud-desktop-health/{app_version}"))
            .connect_timeout(Duration::from_secs(3));
        if pooled {
            builder.build()
        } else {
            builder.pool_max_idle_per_host(0).build()
        }
    };
    // Счётчик объёма у DPI живёт на TCP-сессии: переиспользованная приходит к
    // пробе уже за порогом, и тогда любой замер показывает вмешательство.
    let (client, probe_client) = match (build(true), build(false)) {
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

impl Agent {
    async fn run(self) {
        let watcher_nudge = self.nudge.clone();
        tokio::spawn(net_watch::run(watcher_nudge));

        let mut topology = Topology::bootstrap();
        let mut round = 0usize;
        loop {
            let started = Instant::now();
            round = round.wrapping_add(1);
            if let Some(fresh) = self.delivery.fetch_topology(&topology).await {
                topology = fresh;
            }

            let pool = Pool {
                relays: discovery::relays(&topology.relays).await,
                calls: discovery::calls(&topology.call_nodes()).await,
            };
            edge::set_pool(pool.relays.clone(), topology.weighted_calls(&pool.calls));

            let paths = probe::probe_paths(&self.probe_client, &pool, round).await;
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
            let late = self
                .delivery
                .report(&topology, &self.client_id, &self.app_version, &services)
                .await;

            let delivered = early || late;
            let ok = services.iter().filter(|sample| sample.ok).count();
            log_native(
                &self.app,
                if delivered { "INFO" } else { "WARN" },
                format!(
                    "[Health] topology={} relays={} calls={} samples={} reachable={} delivered={} elapsed={}ms",
                    topology.version,
                    pool.relays.len(),
                    pool.calls.len(),
                    paths.len() + services.len(),
                    ok,
                    delivered,
                    started.elapsed().as_millis()
                ),
            );

            let interval = Duration::from_secs(topology.probe_interval_secs.max(30));
            tokio::select! {
                _ = tokio::time::sleep(interval) => {}
                _ = self.nudge.notified() => {
                    tokio::time::sleep(MIN_ROUND_GAP).await;
                }
            }
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
    use super::load_or_create_identity;

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

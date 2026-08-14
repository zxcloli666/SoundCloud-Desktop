mod delivery;
mod discovery;
mod link;
mod model;
mod net_watch;
mod probe;

use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::runtime::Handle;
use tokio::sync::Notify;

use self::delivery::Delivery;
use self::model::Topology;
use self::probe::Pool;
use crate::network::edge;
use crate::app::diagnostics::log_native;

const MIN_ROUND_GAP: Duration = Duration::from_secs(15);

struct Agent {
    app: crate::rt::AppHandle,
    delivery: Delivery,
    probe_client: reqwest::Client,
    nudge: Arc<Notify>,
}

pub fn start(app: crate::rt::AppHandle, runtime: Handle) {
    let app_version = env!("CARGO_PKG_VERSION").to_string();
    let build = |pooled: bool| {
        let builder = reqwest::Client::builder()
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
            };
            edge::set_pool(pool.relays.clone());

            let paths = probe::probe_paths(&self.probe_client, &pool, round).await;
            let services = probe::probe_services(&self.probe_client, &topology, &pool).await;
            let ok = services.iter().filter(|sample| sample.ok).count();
            log_native(
                &self.app,
                if ok > 0 { "INFO" } else { "WARN" },
                format!(
                    "[Health] topology={} relays={} samples={} reachable={} elapsed={}ms",
                    topology.version,
                    pool.relays.len(),
                    paths.len() + services.len(),
                    ok,
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

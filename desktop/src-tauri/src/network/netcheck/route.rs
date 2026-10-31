use std::time::Duration;

use futures_util::future::join_all;
use serde::Deserialize;
use serde_json::Value;

use super::model::{AppProbe, RelayRoute, ServiceRoute, Upstream, UpstreamState};
use super::targets::app_probe;
use crate::network::edge;

const ROUTE_TIMEOUT: Duration = Duration::from_secs(10);
const ORIGINS: [&str; 4] = ["main", "star", "s3", "images"];
const MAIN: &str = "main";

pub const API: &str = "api";
pub const SERVICES: [Service; 5] = [
    Service::new(API, MAIN, "/health"),
    Service::new("api-star", "star", "/health"),
    Service::new("stream", MAIN, "/health"),
    Service::new("storage", MAIN, "/health"),
    Service::new("s3", "s3", "/healthz"),
];

pub struct Service {
    pub label: &'static str,
    origin: &'static str,
    path: &'static str,
}

impl Service {
    const fn new(label: &'static str, origin: &'static str, path: &'static str) -> Self {
        Self {
            label,
            origin,
            path,
        }
    }
}

#[derive(Deserialize)]
struct Seen {
    direct: u8,
    #[serde(default)]
    backup: u8,
}

pub async fn of(node: &str, client: Option<&wreq::Client>) -> Option<RelayRoute> {
    let client = client?;
    let urls = SERVICES.iter().map(|service| {
        format!(
            "https://{}{}",
            edge::relay_host(service.label, node),
            service.path
        )
    });
    let (answers, seen) = tokio::join!(probe_all(client, urls), seen(client, node));
    Some(route(answers, seen.as_ref()))
}

pub async fn through_pro(host: &str, client: Option<&wreq::Client>) -> Option<RelayRoute> {
    let client = client?;
    let gateway = edge::gateway_of(host)?;
    let urls = SERVICES.iter().map(|service| {
        let carried = format!(
            "https://{}{}",
            edge::plain_host(service.label),
            service.path
        );
        edge::through_gateway(&gateway, &carried)
    });
    Some(route(probe_all(client, urls).await, None))
}

async fn probe_all(client: &wreq::Client, urls: impl Iterator<Item = String>) -> Vec<AppProbe> {
    join_all(urls.map(|url| async move { app_probe(client, &url, ROUTE_TIMEOUT).await })).await
}

pub async fn seen(client: &wreq::Client, node: &str) -> Option<Value> {
    let url = format!("https://{node}.{}/upstreams", edge::relay_zone());
    let answer = async {
        let response = client.get(&url).send().await.ok()?;
        if !response.status().is_success() {
            return None;
        }
        response.json::<Value>().await.ok()
    };
    tokio::time::timeout(ROUTE_TIMEOUT, answer)
        .await
        .ok()
        .flatten()
}

pub fn route(answers: Vec<AppProbe>, seen: Option<&Value>) -> RelayRoute {
    let upstreams: Vec<Upstream> = ORIGINS
        .iter()
        .filter_map(|origin| {
            let seen: Seen = serde_json::from_value(seen?.get(*origin)?.clone()).ok()?;
            Some(Upstream {
                origin: origin.to_string(),
                state: state_of(&seen),
            })
        })
        .collect();
    let services = SERVICES
        .iter()
        .zip(answers)
        .map(|(service, probe)| {
            let reported = upstreams
                .iter()
                .find(|upstream| upstream.origin == service.origin)
                .map(|upstream| upstream.state);
            let state = match (probe.ok, reported) {
                (false, _) => UpstreamState::Down,
                (true, Some(UpstreamState::Backup)) => UpstreamState::Backup,
                (true, _) => UpstreamState::Ok,
            };
            ServiceRoute {
                service: service.label.to_string(),
                state,
                probe,
            }
        })
        .collect();
    RelayRoute {
        services,
        upstreams,
    }
}

pub fn lost_main(seen: &Value) -> bool {
    seen.get(MAIN)
        .and_then(|main| serde_json::from_value::<Seen>(main.clone()).ok())
        .is_some_and(|main| state_of(&main) == UpstreamState::Down)
}

fn state_of(seen: &Seen) -> UpstreamState {
    if seen.direct > 0 {
        UpstreamState::Ok
    } else if seen.backup > 0 {
        UpstreamState::Backup
    } else {
        UpstreamState::Down
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{SERVICES, lost_main, route};
    use crate::network::netcheck::model::{AppProbe, RelayRoute, UpstreamState};

    fn answered(ok: bool) -> AppProbe {
        AppProbe {
            ok,
            status: Some(if ok { 200 } else { 503 }),
            ms: Some(120),
            fail: None,
        }
    }

    fn all(ok: bool) -> Vec<AppProbe> {
        SERVICES.iter().map(|_| answered(ok)).collect()
    }

    fn states(route: &RelayRoute) -> Vec<(&str, UpstreamState)> {
        route
            .services
            .iter()
            .map(|service| (service.service.as_str(), service.state))
            .collect()
    }

    #[test]
    fn every_service_is_named_by_what_came_back_through_the_relay() {
        let seen = json!({
            "node": "r2",
            "main": {"direct": 0, "backup": 1},
            "star": {"direct": 1, "backup": 1},
            "s3": {"direct": 1},
            "images": {"direct": 0}
        });
        let mut answers = all(true);
        answers[4] = answered(false);
        let route = route(answers, Some(&seen));
        assert_eq!(
            states(&route),
            [
                ("api", UpstreamState::Backup),
                ("api-star", UpstreamState::Ok),
                ("stream", UpstreamState::Backup),
                ("storage", UpstreamState::Backup),
                ("s3", UpstreamState::Down),
            ]
        );
        assert_eq!(route.upstreams.len(), 4);
        assert_eq!(route.upstreams[3].state, UpstreamState::Down);
        assert!(route.carries("api"));
        assert!(!route.carries("s3"));
        assert!(!route.carries_all());
    }

    #[test]
    fn a_service_that_did_not_answer_is_down_whatever_the_relay_says() {
        let seen = json!({"main": {"direct": 1}});
        let route = route(all(false), Some(&seen));
        assert_eq!(route.services[0].state, UpstreamState::Down);
        assert!(!route.carries("api"));
    }

    #[test]
    fn a_route_without_upstreams_still_has_its_services() {
        let route = route(all(true), None);
        assert!(route.upstreams.is_empty());
        assert!(route.carries_all());
        assert_eq!(route.services.len(), SERVICES.len());
    }

    #[test]
    fn only_a_relay_with_no_path_at_all_has_lost_main() {
        assert!(lost_main(&json!({"main": {"direct": 0, "backup": 0}})));
        assert!(lost_main(&json!({"main": {"direct": 0}})));
        assert!(!lost_main(&json!({"main": {"direct": 0, "backup": 1}})));
        assert!(!lost_main(&json!({"star": {"direct": 0}})));
    }
}

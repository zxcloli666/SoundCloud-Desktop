use std::time::Duration;

use tokio::runtime::Handle;
use voice_nlu::{Kind, Variant};
use voice_resolve::Entity;
use wreq::Method;

use super::resolve;
use crate::network::edge;
use crate::network::netcheck::model::Role;
use crate::network::{fetch, traced};
use crate::rt::AppHandle;

const TIMEOUT: Duration = Duration::from_secs(4);
const BASES: [&str; 2] = ["api-star", "api"];

pub struct ResolveCatalog {
    pub app: AppHandle,
    pub rt: Handle,
}

impl voice_engine::Catalog for ResolveCatalog {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Result<Vec<Entity>, String> {
        let body = resolve::request(variants, kinds);
        if body.variants.is_empty() {
            return Ok(Vec::new());
        }
        self.rt.block_on(post(&self.app, &body))
    }
}

async fn post(app: &AppHandle, body: &resolve::Request) -> Result<Vec<Entity>, String> {
    let token = crate::auth::session_token(Some(app))
        .await
        .ok_or("no session")?;
    let client = fetch::client().ok_or("http client is unavailable")?;
    let mut last = String::from("no route");
    for base in BASES {
        let url = format!("https://{}/search/resolve", edge::plain_host(base));
        for (at, hop) in edge::plan(&url).iter().enumerate() {
            let (request, flight) =
                traced::begin(client, Method::POST, hop, Role::of_index(at), "voice");
            let sent = request
                .header("x-session-id", token.as_str())
                .json(body)
                .timeout(TIMEOUT)
                .send()
                .await;
            let response = match sent {
                Ok(response) => response,
                Err(error) => {
                    flight.broke(&error);
                    hop.note(false);
                    last = format!("{}: {error}", hop.tier_label());
                    continue;
                }
            };
            let status = response.status();
            flight.answered(status.as_u16(), 0);
            if !edge::hop_ok(hop, &response) {
                last = format!("{}: HTTP {status}", hop.tier_label());
                continue;
            }
            hop.note(true);
            if !status.is_success() {
                last = format!("{base}: HTTP {status}");
                break;
            }
            let value: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
            return Ok(resolve::entities(&value));
        }
    }
    Err(last)
}

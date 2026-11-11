use std::time::Duration;

use tokio::runtime::Handle;
use voice_engine::{Engine, EntityEvent};
use voice_nlu::{Kind, Variant};
use voice_resolve::{Boosts, Entity};
use wreq::Method;

use super::{Voice, resolve};
use crate::app::diagnostics;
use crate::network::edge;
use crate::network::netcheck::model::Role;
use crate::network::{fetch, traced};
use crate::rt::AppHandle;

const TIMEOUT: Duration = Duration::from_secs(4);
const BASES: [&str; 2] = ["api-star", "api"];
const BEST: usize = 8;

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

pub async fn search(
    voice: &Voice,
    name: &str,
    kinds: &[String],
) -> Result<Vec<EntityEvent>, String> {
    let asked: Vec<Kind> = kinds.iter().filter_map(|k| Kind::from_name(k)).collect();
    let kinds = if asked.is_empty() {
        Kind::ALL.to_vec()
    } else {
        asked
    };
    let readings = voice_resolve::named(name);
    let variants: Vec<Variant> = readings.iter().flat_map(|r| r.queries.clone()).collect();
    let liked = voice.config.lock().unwrap().boosts.artists.clone();
    let found = looked_up(voice.engine.clone(), variants, kinds.clone()).await?;
    let fit = voice_resolve::matches(&readings, &found, &kinds, &Boosts::liked_artists(&liked));
    Ok(fit
        .iter()
        .take(BEST)
        .map(|s| EntityEvent::from(&s.entity))
        .collect())
}

async fn looked_up(
    engine: Engine,
    variants: Vec<Variant>,
    kinds: Vec<Kind>,
) -> Result<Vec<Entity>, String> {
    let asked = move || engine.candidates(&variants, &kinds);
    let (found, looked) = tokio::task::spawn_blocking(asked)
        .await
        .map_err(|error| error.to_string())?;
    diagnostics::log("INFO", format!("[Voice] search: {looked}"));
    found
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

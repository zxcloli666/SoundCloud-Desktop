use std::sync::{Arc, RwLock};
use std::time::Duration;

use futures_util::future::join_all;
use tokio::runtime::Handle;
use voice_engine::{Candidates, Engine, EntityEvent};
use voice_nlu::{Kind, Variant};
use voice_resolve::{Boosts, Entity, Library};
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
const SHOWN: usize = 10;
const SHELVES: [(Kind, &str); 2] = [(Kind::Track, "tracks"), (Kind::Playlist, "playlists")];

pub struct ResolveCatalog {
    pub app: AppHandle,
    pub rt: Handle,
    pub library: Arc<RwLock<Library>>,
}

impl voice_engine::Catalog for ResolveCatalog {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Result<Candidates, String> {
        let body = resolve::request(variants, kinds);
        if body.variants.is_empty() {
            return Ok(Candidates::default());
        }
        let mut found = self.rt.block_on(post(&self.app, &body))?;
        let library = self.library.read().unwrap();
        let mine = voice_resolve::Catalog::candidates(&*library, variants, kinds);
        joined(&mut found.entities, mine);
        Ok(found)
    }
}

pub async fn search(
    app: &AppHandle,
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
    let looked = looked_up(voice.engine.clone(), variants, kinds.clone());
    let (found, shown) = tokio::join!(looked, shelves(app, name, &kinds));
    let mut found = found?;
    joined(&mut found, shown);
    let fit = voice_resolve::matches(&readings, &found, &kinds, &Boosts::liked_artists(&liked));
    Ok(fit
        .iter()
        .take(BEST)
        .map(|s| EntityEvent::from(&s.entity))
        .collect())
}

fn joined(found: &mut Vec<Entity>, more: Vec<Entity>) {
    for entity in more {
        if !found
            .iter()
            .any(|f| f.kind == entity.kind && f.id == entity.id)
        {
            found.push(entity);
        }
    }
}

async fn shelves(app: &AppHandle, name: &str, kinds: &[Kind]) -> Vec<Entity> {
    let asked = SHELVES.iter().filter(|(kind, _)| kinds.contains(kind));
    let pages = asked.map(|(kind, shelf)| async move {
        let path = format!(
            "/search/db/{shelf}?q={}&limit={SHOWN}&page=0",
            urlencoding::encode(name)
        );
        match call(app, Method::GET, &path, None).await {
            Ok(page) => resolve::shown(*kind, &page),
            Err(error) => {
                diagnostics::log("WARN", format!("[Voice] app search {shelf}: {error}"));
                Vec::new()
            }
        }
    });
    join_all(pages).await.into_iter().flatten().collect()
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

async fn post(app: &AppHandle, body: &resolve::Request) -> Result<Candidates, String> {
    let value = call(app, Method::POST, "/search/resolve", Some(body)).await?;
    Ok(Candidates {
        entities: resolve::entities(&value),
        partial: resolve::partial(&value),
    })
}

async fn call(
    app: &AppHandle,
    method: Method,
    path: &str,
    body: Option<&resolve::Request>,
) -> Result<serde_json::Value, String> {
    let token = crate::auth::session_token(Some(app))
        .await
        .ok_or("no session")?;
    let client = fetch::client().ok_or("http client is unavailable")?;
    let mut last = String::from("no route");
    for base in BASES {
        let url = format!("https://{}{path}", edge::plain_host(base));
        for (at, hop) in edge::plan(&url).iter().enumerate() {
            let (request, flight) =
                traced::begin(client, method.clone(), hop, Role::of_index(at), "voice");
            let request = request
                .header("x-session-id", token.as_str())
                .timeout(TIMEOUT);
            let request = match body {
                Some(body) => request.json(body),
                None => request,
            };
            let response = match request.send().await {
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
                let refusal = response.json().await.unwrap_or_default();
                if resolve::timed_out(&refusal) {
                    return Err(last);
                }
                break;
            }
            return response.json().await.map_err(|e| e.to_string());
        }
    }
    Err(last)
}

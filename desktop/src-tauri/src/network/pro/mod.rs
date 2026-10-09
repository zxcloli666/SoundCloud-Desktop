mod gateway;
mod pieces;

use std::sync::OnceLock;
use std::time::{Duration, Instant};

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use bytes::Bytes;
use futures_util::StreamExt;
use futures_util::stream::BoxStream;
use http::Version;
use serde::{Deserialize, Serialize};

pub use gateway::route;

use crate::network::{edge, system_proxy};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const OPEN_TIMEOUT: Duration = Duration::from_secs(40);
const HEALTH_TIMEOUT: Duration = Duration::from_secs(5);
const PROBE_TIMEOUT: Duration = Duration::from_secs(30);
const PROBE_BYTES: usize = 64 * 1024;
const PROBE_ORIGIN: &str = "https://health.scnative.space/probe";
const SIZED: [u16; 2] = [200, 206];

#[derive(Clone)]
pub struct Asked {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<Vec<u8>>,
}

pub struct Answer {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: BoxStream<'static, Result<Bytes, String>>,
}

#[derive(Serialize)]
struct Open<'a> {
    method: &'a str,
    url: &'a str,
    headers: &'a [(String, String)],
    #[serde(skip_serializing_if = "Option::is_none")]
    body: Option<String>,
}

#[derive(Deserialize)]
struct Opened {
    id: String,
    status: u16,
    headers: Vec<(String, String)>,
}

fn client() -> Option<&'static wreq::Client> {
    static CLIENT: OnceLock<Option<wreq::Client>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            system_proxy::follow(wreq::Client::builder())
                .pool_max_idle_per_host(0)
                .connect_timeout(CONNECT_TIMEOUT)
                .build()
                .ok()
        })
        .as_ref()
}

pub async fn fetch(node: &str, asked: Asked) -> Result<Answer, String> {
    let client = client().ok_or("pro: http client is unavailable")?;
    let open = Open {
        method: &asked.method,
        url: &asked.url,
        headers: &asked.headers,
        body: asked.body.as_deref().map(|body| BASE64.encode(body)),
    };
    let response = client
        .post(format!("{node}/open"))
        .version(Version::HTTP_11)
        .timeout(OPEN_TIMEOUT)
        .json(&open)
        .send()
        .await
        .map_err(|error| format!("pro: open failed: {error}"))?;
    if !response.status().is_success() {
        return Err(format!("pro: open answered {}", response.status()));
    }
    let opened: Opened = response
        .json()
        .await
        .map_err(|error| format!("pro: open answer is unreadable: {error}"))?;

    let sized = asked.method.eq_ignore_ascii_case("GET") && SIZED.contains(&opened.status);
    let total = sized.then(|| content_length(&opened.headers)).flatten();
    let body = pieces::stream(client, format!("{node}/take/{}", opened.id), total);
    Ok(Answer {
        status: opened.status,
        headers: opened.headers,
        body,
    })
}

pub async fn whole(host: &str, asked: Asked) -> Result<(u16, Vec<u8>), String> {
    let mut answer = fetch(&format!("https://{host}"), asked).await?;
    let mut body = Vec::new();
    while let Some(piece) = answer.body.next().await {
        body.extend_from_slice(&piece?);
    }
    Ok((answer.status, body))
}

pub struct Probed {
    pub ok: bool,
    pub bytes: usize,
    pub ms: u32,
}

pub async fn carries(host: &str) -> Probed {
    let started = Instant::now();
    let asked = Asked {
        method: "GET".to_string(),
        url: format!("{PROBE_ORIGIN}?bytes={PROBE_BYTES}"),
        headers: Vec::new(),
        body: None,
    };
    let bytes = match tokio::time::timeout(PROBE_TIMEOUT, whole(host, asked)).await {
        Ok(Ok((200, body))) => body.len(),
        _ => 0,
    };
    Probed {
        ok: bytes == PROBE_BYTES,
        bytes,
        ms: started.elapsed().as_millis().min(u32::MAX as u128) as u32,
    }
}

pub async fn answers(host: &str) -> Probed {
    let started = Instant::now();
    let health = match client() {
        Some(client) => client
            .get(format!("https://{host}/health"))
            .version(Version::HTTP_11)
            .timeout(HEALTH_TIMEOUT)
            .send()
            .await
            .is_ok_and(|answer| answer.status().is_success()),
        None => false,
    };
    Probed {
        ok: health,
        bytes: 0,
        ms: started.elapsed().as_millis().min(u32::MAX as u128) as u32,
    }
}

pub async fn reachable() -> bool {
    for host in edge::pro_hosts() {
        if answers(&host).await.ok {
            return true;
        }
    }
    false
}

fn content_length(headers: &[(String, String)]) -> Option<u64> {
    headers
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case("content-length"))
        .and_then(|(_, value)| value.trim().parse().ok())
}

#[cfg(test)]
mod tests;

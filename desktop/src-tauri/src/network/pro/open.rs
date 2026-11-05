use std::time::Duration;

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use http::Version;
use serde::{Deserialize, Serialize};

use super::Asked;

const OPEN_TIMEOUT: Duration = Duration::from_secs(40);

#[derive(Serialize)]
struct Open<'a> {
    method: &'a str,
    url: &'a str,
    headers: &'a [(String, String)],
    #[serde(skip_serializing_if = "Option::is_none")]
    body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    body_stage: Option<&'a str>,
}

#[derive(Deserialize)]
pub struct Opened {
    pub id: String,
    pub status: u16,
    pub headers: Vec<(String, String)>,
}

pub enum Unopened {
    Link(String),
    Refused(u16),
    Unreadable(String),
}

impl Unopened {
    pub fn explained(self) -> String {
        match self {
            Self::Link(error) => format!("pro: open failed: {error}"),
            Self::Refused(status) => format!("pro: open answered {status}"),
            Self::Unreadable(error) => format!("pro: open answer is unreadable: {error}"),
        }
    }
}

pub async fn plain(client: &wreq::Client, node: &str, asked: &Asked) -> Result<Opened, Unopened> {
    let body = asked.body.as_deref().map(|body| BASE64.encode(body));
    send(client, node, &Open::of(asked, body, None)).await
}

pub async fn staged(
    client: &wreq::Client,
    node: &str,
    asked: &Asked,
    stage: &str,
) -> Result<Opened, Unopened> {
    send(client, node, &Open::of(asked, None, Some(stage))).await
}

impl<'a> Open<'a> {
    fn of(asked: &'a Asked, body: Option<String>, body_stage: Option<&'a str>) -> Self {
        Self {
            method: &asked.method,
            url: &asked.url,
            headers: &asked.headers,
            body,
            body_stage,
        }
    }
}

async fn send(client: &wreq::Client, node: &str, open: &Open<'_>) -> Result<Opened, Unopened> {
    let response = client
        .post(format!("{node}/open"))
        .version(Version::HTTP_11)
        .timeout(OPEN_TIMEOUT)
        .json(open)
        .send()
        .await
        .map_err(|error| Unopened::Link(error.to_string()))?;
    if !response.status().is_success() {
        return Err(Unopened::Refused(response.status().as_u16()));
    }
    response
        .json()
        .await
        .map_err(|error| Unopened::Unreadable(error.to_string()))
}

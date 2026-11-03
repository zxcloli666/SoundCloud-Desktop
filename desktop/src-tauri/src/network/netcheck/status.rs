use std::time::Duration;

use futures_util::future::join_all;

use super::model::{Internet, Remote};
use crate::network::edge;
use crate::network::fail::{self, FailKind};
use crate::network::pro::{self, Asked};

pub const EXTERNAL_TIMEOUT: Duration = Duration::from_secs(10);
const STATUS_VERDICT_URL: &str = "https://status.getsoundcloud.app/api/verdict";

pub async fn internet(client: &wreq::Client) -> Internet {
    let checks = [
        reachable(
            client,
            "https://www.gstatic.com/generate_204",
            |status, _| status == 204,
        ),
        reachable(
            client,
            "https://detectportal.firefox.com/success.txt",
            |status, body| status == 200 && body.starts_with("success"),
        ),
        reachable(
            client,
            "https://www.cloudflare.com/cdn-cgi/trace",
            |status, _| status == 200,
        ),
    ];
    if join_all(checks).await.into_iter().any(|ok| ok) {
        Internet::Online
    } else {
        Internet::Offline
    }
}

async fn reachable(client: &wreq::Client, url: &str, valid: fn(u16, &str) -> bool) -> bool {
    let attempt = async {
        match client.get(url).send().await {
            Ok(response) => {
                let status = response.status().as_u16();
                let body = response.text().await.unwrap_or_default();
                valid(status, &body)
            }
            Err(error) => fail::of_wreq(&error) == FailKind::TlsCert,
        }
    };
    tokio::time::timeout(EXTERNAL_TIMEOUT, attempt)
        .await
        .unwrap_or(false)
}

pub async fn remote(client: &wreq::Client) -> Remote {
    remote_of(verdict(Some(client)).await.as_ref())
}

pub async fn verdict(client: Option<&wreq::Client>) -> Option<serde_json::Value> {
    if let Some(client) = client
        && let Some(payload) = verdict_direct(client).await
    {
        return Some(payload);
    }
    verdict_through_pro().await
}

async fn verdict_direct(client: &wreq::Client) -> Option<serde_json::Value> {
    let attempt = async {
        let response = client.get(STATUS_VERDICT_URL).send().await.ok()?;
        if !response.status().is_success() {
            return None;
        }
        response.json::<serde_json::Value>().await.ok()
    };
    tokio::time::timeout(EXTERNAL_TIMEOUT, attempt)
        .await
        .ok()
        .flatten()
}

async fn verdict_through_pro() -> Option<serde_json::Value> {
    let asked = Asked {
        method: "GET".to_string(),
        url: STATUS_VERDICT_URL.to_string(),
        headers: Vec::new(),
        body: None,
    };
    for host in edge::pro_hosts() {
        let answer = tokio::time::timeout(EXTERNAL_TIMEOUT, pro::whole(&host, asked.clone())).await;
        if let Ok(Ok((status, body))) = answer
            && let Some(payload) = verdict_of_answer(status, &body)
        {
            return Some(payload);
        }
    }
    None
}

fn verdict_of_answer(status: u16, body: &[u8]) -> Option<serde_json::Value> {
    if !(200..300).contains(&status) {
        return None;
    }
    serde_json::from_slice(body).ok()
}

pub fn remote_of(payload: Option<&serde_json::Value>) -> Remote {
    let main = payload
        .and_then(|payload| payload.get("roles"))
        .and_then(|roles| roles.get("main"))
        .and_then(serde_json::Value::as_str);
    match main {
        Some("operational" | "degraded") => Remote::Up,
        Some("down") => Remote::Down,
        _ => Remote::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{remote_of, verdict_of_answer};
    use crate::network::netcheck::model::Remote;

    #[test]
    fn the_status_page_verdict_is_read_like_the_frontend_does() {
        assert_eq!(
            remote_of(Some(&json!({"roles": {"main": "operational"}}))),
            Remote::Up
        );
        assert_eq!(
            remote_of(Some(&json!({"roles": {"main": "degraded"}}))),
            Remote::Up
        );
        assert_eq!(
            remote_of(Some(&json!({"roles": {"main": "down"}}))),
            Remote::Down
        );
        assert_eq!(remote_of(Some(&json!({"roles": {}}))), Remote::Unknown);
        assert_eq!(remote_of(None), Remote::Unknown);
    }

    #[test]
    fn a_verdict_through_pro_is_read_like_a_direct_one() {
        let body = br#"{"roles":{"main":"down","playback":"operational"}}"#;
        let payload = verdict_of_answer(200, body).unwrap();
        assert_eq!(remote_of(Some(&payload)), Remote::Down);
        assert!(verdict_of_answer(502, body).is_none());
        assert!(verdict_of_answer(200, b"<html>blocked</html>").is_none());
        assert!(verdict_of_answer(200, b"").is_none());
    }
}

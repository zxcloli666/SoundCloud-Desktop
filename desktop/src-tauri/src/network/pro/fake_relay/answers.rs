use std::collections::HashMap;

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use serde::Deserialize;
use serde_json::json;
use warp::http::Response;
use warp::hyper::Body;

use super::{Kind, Relay, Shared, empty, json};

const NOT_FORWARDED: [&str; 5] = [
    "host",
    "connection",
    "content-length",
    "transfer-encoding",
    "keep-alive",
];

#[derive(Deserialize)]
pub struct Opening {
    #[serde(default)]
    method: String,
    #[serde(default)]
    url: String,
    #[serde(default)]
    headers: Vec<(String, String)>,
    body: Option<String>,
    body_stage: Option<String>,
}

pub async fn opened(relay: Shared, kind: Kind, asked: Opening) -> Response<Body> {
    if kind != Kind::Forwards {
        return open(&relay, kind, asked);
    }
    let request = forwarded(&asked);
    let body = {
        let mut relay = relay.lock().unwrap();
        relay.opens += 1;
        let body = match carried(&mut relay, kind, asked) {
            Ok(body) => body,
            Err(status) => return empty(status),
        };
        if relay.failing_opens > 0 {
            relay.failing_opens -= 1;
            return empty(502);
        }
        body
    };
    let Ok(answer) = request.body(body.clone()).send().await else {
        return empty(502);
    };
    let mut relay = relay.lock().unwrap();
    relay.delivered.push(body);
    answered(&mut relay, answer.status().as_u16(), Vec::new())
}

fn forwarded(asked: &Opening) -> wreq::RequestBuilder {
    let method = wreq::Method::from_bytes(asked.method.as_bytes()).unwrap();
    let mut request = wreq::Client::new().request(method, &asked.url);
    for (name, value) in &asked.headers {
        if !NOT_FORWARDED.contains(&name.to_ascii_lowercase().as_str()) {
            request = request.header(name, value);
        }
    }
    request
}

fn open(relay: &Shared, kind: Kind, asked: Opening) -> Response<Body> {
    let mut relay = relay.lock().unwrap();
    relay.opens += 1;
    if kind == Kind::RefusesOpen && asked.body_stage.is_some() {
        return empty(429);
    }
    let body = match carried(&mut relay, kind, asked) {
        Ok(body) => body,
        Err(status) => return empty(status),
    };
    if relay.failing_opens > 0 {
        relay.failing_opens -= 1;
        return empty(502);
    }
    relay.delivered.push(body.clone());
    answered(&mut relay, 200, body)
}

fn carried(relay: &mut Relay, kind: Kind, asked: Opening) -> Result<Vec<u8>, u16> {
    let stage = asked.body_stage.filter(|_| kind != Kind::Old);
    match (asked.body, stage) {
        (Some(_), Some(_)) => Err(400),
        (Some(body), None) => BASE64.decode(body).map_err(|_| 400),
        (None, Some(id)) => relay.take(&id, kind),
        (None, None) => Ok(Vec::new()),
    }
}

fn answered(relay: &mut Relay, status: u16, body: Vec<u8>) -> Response<Body> {
    let id = format!("answer-{}", relay.opens);
    let headers = json!([["content-length", body.len().to_string()]]);
    relay.answers.insert(id.clone(), body);
    json(json!({ "id": id, "status": status, "headers": headers }))
}

pub fn piece(relay: &Shared, id: &str, asked: &HashMap<String, String>) -> Response<Body> {
    let relay = relay.lock().unwrap();
    let Some(whole) = relay.answers.get(id) else {
        return empty(502);
    };
    let at = |name: &str| {
        asked
            .get(name)
            .and_then(|value| value.parse::<usize>().ok())
    };
    let from = at("from").unwrap_or(0).min(whole.len());
    let end = (from + at("max").unwrap_or(0)).min(whole.len());
    Response::builder()
        .header("x-pro-end", if end == whole.len() { "1" } else { "0" })
        .header("x-pro-total", whole.len())
        .body(Body::from(whole[from..end].to_vec()))
        .unwrap()
}

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD as BASE64_URL};
use futures_util::StreamExt;
use warp::Filter;
use warp::http::header::{HeaderMap, HeaderName, HeaderValue, LOCATION};
use warp::http::{Method, Response, StatusCode};
use warp::hyper::Body;
use warp::hyper::body::Bytes;

use super::{Answer, Asked, fetch};
use crate::network::edge;

const MAX_BODY: usize = 1024 * 1024;
const NOT_CARRIED: [&str; 5] = [
    "host",
    "connection",
    "content-length",
    "transfer-encoding",
    "keep-alive",
];
const NOT_RETURNED: [&str; 3] = ["connection", "transfer-encoding", "keep-alive"];

pub fn route() -> impl Filter<Extract = (Response<Body>,), Error = warp::Rejection> + Clone {
    warp::path!("pro" / String / String)
        .and(warp::method())
        .and(warp::header::headers_cloned())
        .and(warp::body::bytes())
        .then(carry)
}

async fn carry(
    pro_host: String,
    encoded: String,
    method: Method,
    headers: HeaderMap,
    body: Bytes,
) -> Response<Body> {
    let target = BASE64_URL
        .decode(encoded.as_bytes())
        .ok()
        .and_then(|url| String::from_utf8(url).ok())
        .filter(|url| edge::is_routed(url));
    let (Some(target), Some(gateway)) = (target, edge::gateway_of(&pro_host)) else {
        return refused(StatusCode::FORBIDDEN);
    };
    if body.len() > MAX_BODY {
        return refused(StatusCode::BAD_GATEWAY);
    }
    let asked = Asked {
        method: method.as_str().to_string(),
        url: target.clone(),
        headers: carried(&headers),
        body: (!body.is_empty()).then(|| body.to_vec()),
    };
    match fetch(&format!("https://{pro_host}"), asked).await {
        Ok(answer) => answered(answer, &target, &gateway),
        Err(_) => refused(StatusCode::BAD_GATEWAY),
    }
}

fn carried(headers: &HeaderMap) -> Vec<(String, String)> {
    headers
        .iter()
        .filter(|(name, _)| !NOT_CARRIED.contains(&name.as_str()))
        .filter_map(|(name, value)| {
            Some((name.as_str().to_string(), value.to_str().ok()?.to_string()))
        })
        .collect()
}

fn answered(answer: Answer, target: &str, gateway: &str) -> Response<Body> {
    let body = answer
        .body
        .map(|piece| piece.map_err(std::io::Error::other));
    let mut response = Response::new(Body::wrap_stream(body));
    *response.status_mut() = StatusCode::from_u16(answer.status).unwrap_or(StatusCode::BAD_GATEWAY);
    for (name, value) in answer.headers {
        if NOT_RETURNED.contains(&name.to_ascii_lowercase().as_str()) {
            continue;
        }
        let value = if name.eq_ignore_ascii_case(LOCATION.as_str()) {
            relocated(&value, target, gateway)
        } else {
            value
        };
        if let (Ok(name), Ok(value)) = (
            HeaderName::from_bytes(name.as_bytes()),
            HeaderValue::from_str(&value),
        ) {
            response.headers_mut().append(name, value);
        }
    }
    response
}

fn relocated(location: &str, target: &str, gateway: &str) -> String {
    let absolute = url::Url::parse(target)
        .and_then(|base| base.join(location))
        .map(String::from)
        .unwrap_or_else(|_| location.to_string());
    if edge::is_routed(&absolute) {
        edge::through_gateway(gateway, &absolute)
    } else {
        absolute
    }
}

fn refused(status: StatusCode) -> Response<Body> {
    let mut response = Response::new(Body::empty());
    *response.status_mut() = status;
    response
}

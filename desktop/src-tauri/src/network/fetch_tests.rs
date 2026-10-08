use std::time::Duration;

use serde_json::{Value, json};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use wreq::Method;

use super::{FetchRequest, Head, NetKind, Route, frame, net_kind, outgoing, perform};
use crate::network::edge::Tier;
use crate::network::fail::FailKind;
use crate::network::netcheck::model::Role;
use crate::network::netcheck::paths;

fn split(frame: &[u8]) -> (Value, &[u8]) {
    let size = u32::from_be_bytes(frame[..4].try_into().unwrap()) as usize;
    let head = serde_json::from_slice(&frame[4..4 + size]).unwrap();
    (head, &frame[4 + size..])
}

fn request(url: String, method: &str, timeout_ms: Option<u64>) -> FetchRequest {
    FetchRequest {
        id: 1,
        url,
        method: method.to_string(),
        headers: vec![("accept".to_string(), "application/json".to_string())],
        body: None,
        timeout_ms,
        route: None,
    }
}

fn client() -> wreq::Client {
    wreq::Client::builder().no_proxy().build().unwrap()
}

async fn server(reply: &'static [u8], stall: Duration) -> (String, oneshot::Receiver<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let (seen, heard) = oneshot::channel();
    tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut raw = Vec::new();
        let mut buf = [0u8; 2048];
        while !raw.windows(4).any(|w| w == b"\r\n\r\n") {
            let read = stream.read(&mut buf).await.unwrap_or(0);
            if read == 0 {
                break;
            }
            raw.extend_from_slice(&buf[..read]);
        }
        let _ = seen.send(String::from_utf8_lossy(&raw).to_lowercase());
        tokio::time::sleep(stall).await;
        let _ = stream.write_all(reply).await;
        tokio::time::sleep(Duration::from_millis(50)).await;
    });
    (format!("http://{addr}/health"), heard)
}

#[test]
fn a_frame_is_a_length_a_json_head_and_the_body() {
    let head = Head::Answer {
        status: 200,
        status_text: "OK".to_string(),
        headers: vec![("content-type".to_string(), "text/plain".to_string())],
        url: "https://api.scnative.space/health".to_string(),
    };
    let bytes = frame(&head, b"fine");
    let (json, body) = split(&bytes);
    assert_eq!(
        json,
        json!({
            "status": 200,
            "statusText": "OK",
            "headers": [["content-type", "text/plain"]],
            "url": "https://api.scnative.space/health"
        })
    );
    assert_eq!(body, b"fine");

    let failed = frame(&Head::failed(NetKind::Timeout, "no answer in time"), &[]);
    let (json, body) = split(&failed);
    assert_eq!(
        json,
        json!({"error": {"kind": "timeout", "message": "no answer in time"}})
    );
    assert!(body.is_empty());
}

#[test]
fn a_long_failure_message_is_cut_on_a_char_boundary() {
    let Head::Failed { error } = Head::failed(NetKind::Other, "я".repeat(300)) else {
        panic!("a failure head");
    };
    assert!(error.message.len() <= 400);
    assert!(error.message.chars().all(|c| c == 'я'));
}

#[test]
fn forbidden_headers_are_dropped_and_an_empty_post_says_zero() {
    let headers = [
        ("Host", "evil.example"),
        ("Content-Length", "99"),
        ("connection", "close"),
        ("x-session-id", "abc"),
        ("bad name", "v"),
    ]
    .map(|(k, v)| (k.to_string(), v.to_string()));
    let map = outgoing(&Method::POST, &headers, false);
    assert!(map.get("host").is_none());
    assert!(map.get("connection").is_none());
    assert_eq!(map.get("x-session-id").unwrap(), "abc");
    assert_eq!(map.get_all("content-length").iter().count(), 1);
    assert_eq!(map.get("content-length").unwrap(), "0");
    assert!(
        outgoing(&Method::GET, &headers, false)
            .get("content-length")
            .is_none()
    );
    assert!(
        outgoing(&Method::POST, &headers, true)
            .get("content-length")
            .is_none()
    );
}

#[test]
fn failure_classes_map_to_frontend_kinds() {
    let table = [
        (FailKind::Dns, NetKind::Dns),
        (FailKind::DnsBogus, NetKind::Dns),
        (FailKind::Timeout, NetKind::Timeout),
        (FailKind::Refused, NetKind::Connect),
        (FailKind::Unreachable, NetKind::Connect),
        (FailKind::Reset, NetKind::Reset),
        (FailKind::Closed, NetKind::Reset),
        (FailKind::TlsCert, NetKind::Tls),
        (FailKind::Tls, NetKind::Tls),
        (FailKind::Body, NetKind::Body),
        (FailKind::Status, NetKind::Other),
        (FailKind::Other, NetKind::Other),
    ];
    for (kind, expected) in table {
        assert_eq!(net_kind(kind), expected, "{kind:?}");
    }
}

#[tokio::test]
async fn an_answer_comes_back_whole_and_the_route_is_recorded() {
    let (url, heard) = server(
        b"HTTP/1.1 201 Created\r\ncontent-type: text/plain\r\nx-a: 1\r\ncontent-length: 2\r\n\r\nhi",
        Duration::ZERO,
    )
    .await;
    let mut ask = request(url.clone(), "post", Some(5_000));
    ask.route = Some(Route {
        tier: Tier::Relay,
        origin: "fetch-test.scnative.space".to_string(),
        attempt: 1,
    });
    let (head, body) = perform(&client(), ask).await;
    let Head::Answer {
        status, headers, ..
    } = head
    else {
        panic!("an answer");
    };
    assert_eq!(status, 201);
    assert!(headers.contains(&("x-a".to_string(), "1".to_string())));
    assert_eq!(body, b"hi");
    let sent = heard.await.unwrap();
    assert!(sent.starts_with("post /health"));
    assert_eq!(sent.matches("content-length: 0").count(), 1);
    let event = paths::recent(100)
        .into_iter()
        .find(|event| event.origin == "fetch-test.scnative.space")
        .unwrap();
    assert_eq!(event.role, Role::Failover);
    assert_eq!(event.source, "api");
    assert_eq!(event.status, Some(201));
}

#[tokio::test]
async fn silence_before_the_headers_is_a_timeout() {
    let (url, _heard) = server(b"", Duration::from_secs(5)).await;
    let (head, _) = perform(&client(), request(url, "GET", Some(300))).await;
    let Head::Failed { error } = head else {
        panic!("a failure");
    };
    assert_eq!(error.kind, NetKind::Timeout);
}

#[tokio::test]
async fn a_body_that_breaks_off_is_a_body_failure() {
    let (url, _heard) = server(
        b"HTTP/1.1 200 OK\r\ncontent-length: 100\r\n\r\npartial",
        Duration::ZERO,
    )
    .await;
    let (head, body) = perform(&client(), request(url, "GET", Some(5_000))).await;
    let Head::Failed { error } = head else {
        panic!("a failure");
    };
    assert_eq!(error.kind, NetKind::Body);
    assert!(body.is_empty());
}

#[tokio::test]
async fn a_closed_port_is_a_connect_failure_without_the_url() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    drop(listener);
    let url = format!("http://{addr}/health?token=secret");
    let (head, _) = perform(&client(), request(url, "GET", None)).await;
    let Head::Failed { error } = head else {
        panic!("a failure");
    };
    assert_eq!(error.kind, NetKind::Connect);
    assert!(!error.message.contains("secret"), "{}", error.message);
}

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use wreq::Method;

use super::begin;
use crate::diag::attempt;
use crate::diag::trace;
use crate::network::edge::{Hop, Tier};
use crate::network::netcheck::model::Role;

async fn serving(seen: Arc<Mutex<Vec<String>>>) -> SocketAddr {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        while let Ok((mut socket, _)) = listener.accept().await {
            let seen = seen.clone();
            tokio::spawn(async move {
                let mut buffer = vec![0u8; 8192];
                let read = socket.read(&mut buffer).await.unwrap_or(0);
                seen.lock()
                    .unwrap()
                    .push(String::from_utf8_lossy(&buffer[..read]).to_string());
                let _ = socket
                    .write_all(
                        b"HTTP/1.1 200 OK\r\ncontent-length: 2\r\nconnection: close\r\n\r\nok",
                    )
                    .await;
            });
        }
    });
    addr
}

fn client_for(host: &'static str, addr: SocketAddr) -> wreq::Client {
    wreq::Client::builder().resolve(host, addr).build().unwrap()
}

fn header_of(request: &str, name: &str) -> Option<String> {
    let prefix = format!("{name}:");
    request
        .lines()
        .find(|line| line.to_ascii_lowercase().starts_with(&prefix))
        .map(|line| line.split_once(':').unwrap().1.trim().to_string())
}

#[tokio::test]
async fn our_hosts_get_a_traceparent_and_the_version_and_the_attempt_is_recorded() {
    let seen = Arc::new(Mutex::new(Vec::new()));
    let addr = serving(seen.clone()).await;
    let host: &'static str = "api.r9.relay.scnative.dev";
    let client = client_for(host, addr);
    let hop = Hop {
        url: format!("http://{host}:{}/me?session_id=abc", addr.port()),
        tier: Tier::Relay,
        origin: "api".to_string(),
    };
    let id = trace::new_trace();
    trace::open_debug();
    let status = trace::within(id.clone(), async {
        let (request, flight) = begin(&client, Method::GET, &hop, Role::Primary, "api");
        let response = request.send().await.unwrap();
        let status = response.status().as_u16();
        flight.answered(status, 2);
        status
    })
    .await;
    assert_eq!(status, 200);

    let request = seen.lock().unwrap()[0].clone();
    assert_eq!(
        header_of(&request, "x-scd-version").as_deref(),
        Some(env!("CARGO_PKG_VERSION"))
    );
    let sent = header_of(&request, "traceparent").expect("traceparent header");
    let parts: Vec<&str> = sent.split('-').collect();
    assert_eq!(parts.len(), 4);
    assert_eq!(parts[0], "00");
    assert_eq!(parts[1], id);
    assert_eq!(parts[2].len(), 16);
    assert_eq!(parts[3], "01");

    let recorded = attempt::oldest_first()
        .into_iter()
        .find(|attempt| attempt.trace == id)
        .expect("recorded attempt");
    assert_eq!(recorded.span, parts[2]);
    assert_eq!(recorded.service, backend_contracts::diag::Service::Api);
    assert_eq!(recorded.status, 200);
    assert_eq!(recorded.method, "GET");
    assert_eq!(recorded.path, "/me?session_id=abc");
    assert_eq!(recorded.hop, "r9");
    assert!(recorded.debug);
}

#[tokio::test]
async fn foreign_hosts_get_no_traceparent_no_version_and_no_record() {
    let seen = Arc::new(Mutex::new(Vec::new()));
    let addr = serving(seen.clone()).await;
    let host: &'static str = "api-v2.soundcloud.com";
    let client = client_for(host, addr);
    let hop = Hop::unplanned(&format!("http://{host}:{}/tracks", addr.port()));
    let id = trace::new_trace();
    trace::within(id.clone(), async {
        let (request, flight) = begin(&client, Method::GET, &hop, Role::Primary, "api");
        let response = request.send().await.unwrap();
        flight.answered(response.status().as_u16(), 0);
    })
    .await;
    let request = seen.lock().unwrap()[0].clone();
    assert!(header_of(&request, "traceparent").is_none());
    assert!(header_of(&request, "x-scd-version").is_none());
    assert!(
        attempt::oldest_first()
            .iter()
            .all(|attempt| attempt.trace != id)
    );
}

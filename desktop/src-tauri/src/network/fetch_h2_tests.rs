use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

use super::{FetchRequest, Head, NetKind, configured, perform};

const PREFACE: usize = 24;
const DATA: u8 = 0;
const HEADERS: u8 = 1;
const SETTINGS: u8 = 4;
const PING: u8 = 6;
const ACK: u8 = 1;
const END_STREAM: u8 = 1;
const END_HEADERS: u8 = 4;
const STATUS_200: [u8; 1] = [0x88];

struct Frame {
    kind: u8,
    flags: u8,
    stream: u32,
    payload: Vec<u8>,
}

async fn read_frame(socket: &mut TcpStream) -> Option<Frame> {
    let mut head = [0u8; 9];
    socket.read_exact(&mut head).await.ok()?;
    let len = u32::from_be_bytes([0, head[0], head[1], head[2]]) as usize;
    let mut payload = vec![0u8; len];
    socket.read_exact(&mut payload).await.ok()?;
    let stream = u32::from_be_bytes([head[5], head[6], head[7], head[8]]) & 0x7fff_ffff;
    Some(Frame {
        kind: head[3],
        flags: head[4],
        stream,
        payload,
    })
}

async fn write_frame(
    socket: &mut TcpStream,
    kind: u8,
    flags: u8,
    stream: u32,
    payload: &[u8],
) -> std::io::Result<()> {
    let mut out = Vec::with_capacity(9 + payload.len());
    out.extend_from_slice(&(payload.len() as u32).to_be_bytes()[1..]);
    out.push(kind);
    out.push(flags);
    out.extend_from_slice(&stream.to_be_bytes());
    out.extend_from_slice(payload);
    socket.write_all(&out).await
}

async fn answer(
    socket: &mut TcpStream,
    stream: u32,
    body: &[u8],
    last: bool,
) -> std::io::Result<()> {
    write_frame(socket, HEADERS, END_HEADERS, stream, &STATUS_200).await?;
    let flags = if last { END_STREAM } else { 0 };
    write_frame(socket, DATA, flags, stream, body).await
}

async fn serve(mut socket: TcpStream, freeze: bool) {
    let mut preface = [0u8; PREFACE];
    if socket.read_exact(&mut preface).await.is_err()
        || write_frame(&mut socket, SETTINGS, 0, 0, &[]).await.is_err()
    {
        return;
    }
    while let Some(frame) = read_frame(&mut socket).await {
        let sent = match frame.kind {
            SETTINGS if frame.flags & ACK == 0 => {
                write_frame(&mut socket, SETTINGS, ACK, 0, &[]).await
            }
            PING if frame.flags & ACK == 0 => {
                write_frame(&mut socket, PING, ACK, 0, &frame.payload).await
            }
            HEADERS if freeze => {
                let _ = answer(&mut socket, frame.stream, b"partial", false).await;
                tokio::time::sleep(Duration::from_secs(120)).await;
                return;
            }
            HEADERS => answer(&mut socket, frame.stream, b"ok", true).await,
            _ => Ok(()),
        };
        if sent.is_err() {
            return;
        }
    }
}

async fn freezing_server() -> (String, Arc<AtomicUsize>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let accepted = Arc::new(AtomicUsize::new(0));
    let counter = accepted.clone();
    tokio::spawn(async move {
        while let Ok((socket, _)) = listener.accept().await {
            let first = counter.fetch_add(1, Ordering::SeqCst) == 0;
            tokio::spawn(serve(socket, first));
        }
    });
    (format!("http://{addr}/health"), accepted)
}

fn h2_client() -> wreq::Client {
    configured(wreq::Client::builder().no_proxy().http2_only())
        .build()
        .unwrap()
}

fn get(url: &str) -> FetchRequest {
    FetchRequest {
        id: 1,
        url: url.to_string(),
        method: "GET".to_string(),
        headers: Vec::new(),
        body: None,
        timeout_ms: Some(40_000),
        route: None,
    }
}

#[tokio::test]
async fn a_frozen_h2_connection_is_dropped_and_later_requests_get_a_fresh_one() {
    let (url, accepted) = freezing_server().await;
    let client = h2_client();
    let started = Instant::now();
    let ((stalled, _), (queued, _)) = tokio::join!(perform(&client, get(&url)), async {
        tokio::time::sleep(Duration::from_millis(300)).await;
        perform(&client, get(&url)).await
    });
    let Head::Failed { error } = stalled else {
        panic!("the stalled body must fail, got {stalled:?}");
    };
    assert_eq!(error.kind, NetKind::Body);
    let Head::Failed { error } = queued else {
        panic!("the queued request must fail, got {queued:?}");
    };
    assert_eq!(error.kind, NetKind::Timeout);
    assert!(
        started.elapsed() < Duration::from_secs(15),
        "{:?}",
        started.elapsed()
    );

    let fresh = Instant::now();
    let (head, body) = perform(&client, get(&url)).await;
    let Head::Answer { status, .. } = head else {
        panic!("a fresh connection must answer, got {head:?}");
    };
    assert_eq!(status, 200);
    assert_eq!(body, b"ok");
    assert!(
        fresh.elapsed() < Duration::from_secs(2),
        "{:?}",
        fresh.elapsed()
    );
    assert_eq!(accepted.load(Ordering::SeqCst), 2);
}

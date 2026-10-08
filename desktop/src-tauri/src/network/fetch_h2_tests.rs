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

#[derive(Clone, Copy)]
enum Mode {
    Healthy,
    Freeze,
    Slow(Duration),
}

async fn serve(mut socket: TcpStream, mode: Mode) {
    let mut preface = [0u8; PREFACE];
    if socket.read_exact(&mut preface).await.is_err()
        || write_frame(&mut socket, SETTINGS, 0, 0, &[]).await.is_err()
    {
        return;
    }
    let mut late: Option<(u32, tokio::time::Instant)> = None;
    loop {
        let due = late.map(|(_, at)| at);
        let frame = tokio::select! {
            frame = read_frame(&mut socket) => frame,
            () = tokio::time::sleep_until(due.unwrap_or_else(tokio::time::Instant::now)), if due.is_some() => {
                if let Some((stream, _)) = late.take()
                    && answer(&mut socket, stream, b"ok", true).await.is_err()
                {
                    return;
                }
                continue;
            }
        };
        let Some(frame) = frame else { return };
        let sent = match (frame.kind, mode) {
            (SETTINGS, _) if frame.flags & ACK == 0 => {
                write_frame(&mut socket, SETTINGS, ACK, 0, &[]).await
            }
            (PING, _) if frame.flags & ACK == 0 => {
                write_frame(&mut socket, PING, ACK, 0, &frame.payload).await
            }
            (HEADERS, Mode::Freeze) => {
                let _ = answer(&mut socket, frame.stream, b"partial", false).await;
                tokio::time::sleep(Duration::from_secs(120)).await;
                return;
            }
            (HEADERS, Mode::Slow(delay)) => {
                late = Some((frame.stream, tokio::time::Instant::now() + delay));
                Ok(())
            }
            (HEADERS, Mode::Healthy) => answer(&mut socket, frame.stream, b"ok", true).await,
            _ => Ok(()),
        };
        if sent.is_err() {
            return;
        }
    }
}

async fn h2_server(first: Mode) -> (String, Arc<AtomicUsize>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let accepted = Arc::new(AtomicUsize::new(0));
    let counter = accepted.clone();
    tokio::spawn(async move {
        while let Ok((socket, _)) = listener.accept().await {
            let mode = if counter.fetch_add(1, Ordering::SeqCst) == 0 {
                first
            } else {
                Mode::Healthy
            };
            tokio::spawn(serve(socket, mode));
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
    let (url, accepted) = h2_server(Mode::Freeze).await;
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
        started.elapsed() < Duration::from_secs(6),
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

#[tokio::test]
async fn a_slow_answer_on_a_live_connection_is_not_cut_by_the_pings() {
    let (url, accepted) = h2_server(Mode::Slow(Duration::from_secs(7))).await;
    let client = h2_client();
    let started = Instant::now();
    let (head, body) = perform(&client, get(&url)).await;
    let Head::Answer { status, .. } = head else {
        panic!("a slow answer must arrive, got {head:?}");
    };
    assert_eq!(status, 200);
    assert_eq!(body, b"ok");
    assert!(started.elapsed() >= Duration::from_secs(7));
    assert_eq!(accepted.load(Ordering::SeqCst), 1);
}

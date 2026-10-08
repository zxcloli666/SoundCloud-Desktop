use std::collections::VecDeque;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use rustls::ServerConfig;
use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio_rustls::TlsAcceptor;

const PREFACE: usize = 24;
const DATA: u8 = 0;
const HEADERS: u8 = 1;
const SETTINGS: u8 = 4;
const PING: u8 = 6;
const ACK: u8 = 1;
const END_STREAM: u8 = 1;
const END_HEADERS: u8 = 4;
const STATUS_200: [u8; 1] = [0x88];
const CERT: &[u8] = include_bytes!("netcheck/fixtures/good.der");
const KEY: &[u8] = include_bytes!("netcheck/fixtures/good.key.der");

struct Frame {
    kind: u8,
    flags: u8,
    stream: u32,
    payload: Vec<u8>,
}

async fn read_frame<S: AsyncRead + Unpin>(socket: &mut S) -> Option<Frame> {
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

async fn write_frame<S: AsyncWrite + Unpin>(
    socket: &mut S,
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

async fn answer<S: AsyncWrite + Unpin>(
    socket: &mut S,
    stream: u32,
    body: &[u8],
    last: bool,
) -> std::io::Result<()> {
    write_frame(socket, HEADERS, END_HEADERS, stream, &STATUS_200).await?;
    let flags = if last { END_STREAM } else { 0 };
    write_frame(socket, DATA, flags, stream, body).await
}

#[derive(Clone, Copy)]
pub enum Mode {
    Healthy,
    Freeze,
    Slow(Duration),
    Lagging(Duration),
}

enum Due {
    Answer(u32),
    Pong(Vec<u8>),
}

async fn serve<S: AsyncRead + AsyncWrite + Unpin>(mut socket: S, mode: Mode) {
    let mut preface = [0u8; PREFACE];
    if socket.read_exact(&mut preface).await.is_err()
        || write_frame(&mut socket, SETTINGS, 0, 0, &[]).await.is_err()
    {
        return;
    }
    let mut late: VecDeque<(tokio::time::Instant, Due)> = VecDeque::new();
    loop {
        let due = late.front().map(|(at, _)| *at);
        let frame = tokio::select! {
            frame = read_frame(&mut socket) => frame,
            () = tokio::time::sleep_until(due.unwrap_or_else(tokio::time::Instant::now)), if due.is_some() => {
                let sent = match late.pop_front() {
                    Some((_, Due::Answer(stream))) => answer(&mut socket, stream, b"ok", true).await,
                    Some((_, Due::Pong(payload))) => write_frame(&mut socket, PING, ACK, 0, &payload).await,
                    None => Ok(()),
                };
                if sent.is_err() {
                    return;
                }
                continue;
            }
        };
        let Some(frame) = frame else { return };
        let later = |delay: Duration| tokio::time::Instant::now() + delay;
        let sent = match (frame.kind, mode) {
            (SETTINGS, _) if frame.flags & ACK == 0 => {
                write_frame(&mut socket, SETTINGS, ACK, 0, &[]).await
            }
            (PING, Mode::Lagging(delay)) if frame.flags & ACK == 0 => {
                late.push_back((later(delay), Due::Pong(frame.payload)));
                Ok(())
            }
            (PING, _) if frame.flags & ACK == 0 => {
                write_frame(&mut socket, PING, ACK, 0, &frame.payload).await
            }
            (HEADERS, Mode::Freeze) => {
                let _ = answer(&mut socket, frame.stream, b"partial", false).await;
                tokio::time::sleep(Duration::from_secs(120)).await;
                return;
            }
            (HEADERS, Mode::Slow(delay) | Mode::Lagging(delay)) => {
                late.push_back((later(delay), Due::Answer(frame.stream)));
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

pub async fn h2_server(first: Mode) -> (String, Arc<AtomicUsize>) {
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

fn acceptor() -> TlsAcceptor {
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let mut config = ServerConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .unwrap()
        .with_no_client_auth()
        .with_single_cert(
            vec![CertificateDer::from(CERT.to_vec())],
            PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(KEY.to_vec())),
        )
        .unwrap();
    config.alpn_protocols = vec![b"h2".to_vec()];
    TlsAcceptor::from(Arc::new(config))
}

pub async fn h2_tls_server() -> (String, Arc<AtomicUsize>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let accepted = Arc::new(AtomicUsize::new(0));
    let counter = accepted.clone();
    let acceptor = acceptor();
    tokio::spawn(async move {
        while let Ok((socket, _)) = listener.accept().await {
            counter.fetch_add(1, Ordering::SeqCst);
            let acceptor = acceptor.clone();
            tokio::spawn(async move {
                if let Ok(stream) = acceptor.accept(socket).await {
                    serve(stream, Mode::Healthy).await;
                }
            });
        }
    });
    (format!("https://{addr}/dns-query"), accepted)
}

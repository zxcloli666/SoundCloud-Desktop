use std::net::{Ipv4Addr, SocketAddr, SocketAddrV4};
use std::sync::Arc;
use std::time::Duration;

use rustls::ServerConfig;
use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio_rustls::TlsAcceptor;

use super::configured;

const CERT: &[u8] = include_bytes!("netcheck/fixtures/good.der");
const KEY: &[u8] = include_bytes!("netcheck/fixtures/good.key.der");
const ANSWER: &[u8] = b"HTTP/1.1 200 OK\r\ncontent-length: 2\r\n\r\nok";

fn acceptor() -> TlsAcceptor {
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let config = ServerConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .unwrap()
        .with_no_client_auth()
        .with_single_cert(
            vec![CertificateDer::from(CERT.to_vec())],
            PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(KEY.to_vec())),
        )
        .unwrap();
    TlsAcceptor::from(Arc::new(config))
}

async fn answer<S: AsyncReadExt + AsyncWriteExt + Unpin>(mut stream: S) {
    let mut raw = Vec::new();
    let mut buf = [0u8; 2048];
    while !raw.windows(4).any(|w| w == b"\r\n\r\n") {
        match stream.read(&mut buf).await {
            Ok(0) | Err(_) => return,
            Ok(read) => raw.extend_from_slice(&buf[..read]),
        }
    }
    let _ = stream.write_all(ANSWER).await;
    let _ = stream.flush().await;
    tokio::time::sleep(Duration::from_secs(10)).await;
}

async fn server(tls: bool) -> SocketAddr {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.unwrap();
    let addr = listener.local_addr().unwrap();
    let acceptor = acceptor();
    tokio::spawn(async move {
        while let Ok((socket, _)) = listener.accept().await {
            let acceptor = acceptor.clone();
            tokio::spawn(async move {
                if !tls {
                    answer(socket).await;
                } else if let Ok(stream) = acceptor.accept(socket).await {
                    answer(stream).await;
                }
            });
        }
    });
    addr
}

fn peer_of(fd: i32) -> Option<SocketAddr> {
    let mut raw: libc::sockaddr_in = unsafe { std::mem::zeroed() };
    let mut len = std::mem::size_of::<libc::sockaddr_in>() as libc::socklen_t;
    let got = unsafe { libc::getpeername(fd, (&raw mut raw).cast(), &raw mut len) };
    if got != 0 || i32::from(raw.sin_family) != libc::AF_INET {
        return None;
    }
    let ip = Ipv4Addr::from(u32::from_be(raw.sin_addr.s_addr));
    let port = u16::from_be(raw.sin_port);
    Some(SocketAddr::V4(SocketAddrV4::new(ip, port)))
}

fn nodelay_of(fd: i32) -> Option<bool> {
    let mut value: libc::c_int = 0;
    let mut len = std::mem::size_of::<libc::c_int>() as libc::socklen_t;
    let got = unsafe {
        libc::getsockopt(
            fd,
            libc::IPPROTO_TCP,
            libc::TCP_NODELAY,
            (&raw mut value).cast(),
            &raw mut len,
        )
    };
    (got == 0).then_some(value != 0)
}

fn client_sockets_to(server: SocketAddr) -> Vec<bool> {
    let Ok(entries) = std::fs::read_dir("/proc/self/fd") else {
        return Vec::new();
    };
    entries
        .filter_map(|entry| entry.ok()?.file_name().to_str()?.parse::<i32>().ok())
        .filter(|fd| peer_of(*fd) == Some(server))
        .filter_map(nodelay_of)
        .collect()
}

async fn nodelay_after_a_request(client: wreq::Client, tls: bool) -> Vec<bool> {
    let addr = server(tls).await;
    let scheme = if tls { "https" } else { "http" };
    let response = client
        .get(format!("{scheme}://{addr}/health"))
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    assert_eq!(response.text().await.unwrap(), "ok");
    client_sockets_to(addr)
}

#[tokio::test]
async fn a_tls_connection_sends_without_waiting_for_acks() {
    let client = configured(
        sc_fingerprint::builder(None)
            .no_proxy()
            .cert_verification(false),
    )
    .build()
    .unwrap();
    let sockets = nodelay_after_a_request(client, true).await;
    assert_eq!(sockets, [true]);
}

#[tokio::test]
async fn a_plain_connection_sends_without_waiting_for_acks() {
    let client = wreq::Client::builder().no_proxy().build().unwrap();
    let sockets = nodelay_after_a_request(client, false).await;
    assert_eq!(sockets, [true]);
}

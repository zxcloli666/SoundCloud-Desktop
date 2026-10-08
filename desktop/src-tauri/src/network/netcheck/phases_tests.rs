use std::net::{IpAddr, Ipv4Addr};
use std::sync::Arc;
use std::time::Duration;

use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer};
use rustls::{RootCertStore, ServerConfig};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio_rustls::TlsAcceptor;

use super::{Budget, Tls, probe, status_of};
use crate::network::fail::{FailKind, Phase};
use crate::network::netcheck::model::PhaseProbe;

const GOOD_CERT: &[u8] = include_bytes!("fixtures/good.der");
const GOOD_KEY: &[u8] = include_bytes!("fixtures/good.key.der");
const OTHER_CERT: &[u8] = include_bytes!("fixtures/other.der");
const OTHER_KEY: &[u8] = include_bytes!("fixtures/other.key.der");
const LOCALHOST: IpAddr = IpAddr::V4(Ipv4Addr::LOCALHOST);

fn acceptor(cert: &[u8], key: &[u8]) -> TlsAcceptor {
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let config = ServerConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .unwrap()
        .with_no_client_auth()
        .with_single_cert(
            vec![CertificateDer::from(cert.to_vec())],
            PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(key.to_vec())),
        )
        .unwrap();
    TlsAcceptor::from(Arc::new(config))
}

fn trusting_good() -> Tls {
    let mut roots = RootCertStore::empty();
    roots.add(CertificateDer::from(GOOD_CERT.to_vec())).unwrap();
    Tls::with_roots(roots).unwrap()
}

#[derive(Clone, Copy)]
enum Mode {
    Healthy(u64),
    ResetOnAccept,
    CloseAfterHello,
    Blackhole,
    StallAfterTls,
    WrongCert,
}

async fn serve(mode: Mode) -> u16 {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let good = acceptor(GOOD_CERT, GOOD_KEY);
    let other = acceptor(OTHER_CERT, OTHER_KEY);
    tokio::spawn(async move {
        while let Ok((mut socket, _)) = listener.accept().await {
            let (good, other) = (good.clone(), other.clone());
            tokio::spawn(async move {
                match mode {
                    Mode::ResetOnAccept => {
                        let mut buf = [0u8; 512];
                        let _ = socket.read(&mut buf).await;
                        let _ = socket.set_zero_linger();
                    }
                    Mode::CloseAfterHello => {
                        let mut buf = [0u8; 512];
                        let _ = socket.read(&mut buf).await;
                        let _ = socket.shutdown().await;
                    }
                    Mode::Blackhole => {
                        tokio::time::sleep(Duration::from_secs(30)).await;
                    }
                    Mode::StallAfterTls => {
                        let _held = good.accept(socket).await;
                        tokio::time::sleep(Duration::from_secs(30)).await;
                    }
                    Mode::WrongCert => {
                        let _ = other.accept(socket).await;
                    }
                    Mode::Healthy(delay_ms) => {
                        let Ok(mut tls) = good.accept(socket).await else {
                            return;
                        };
                        let mut buf = [0u8; 512];
                        let _ = tls.read(&mut buf).await;
                        tokio::time::sleep(Duration::from_millis(delay_ms)).await;
                        let _ = tls
                            .write_all(b"HTTP/1.1 200 OK\r\ncontent-length: 2\r\n\r\nok")
                            .await;
                        let _ = tls.shutdown().await;
                    }
                }
            });
        }
    });
    port
}

fn quick() -> Budget {
    Budget {
        tcp: Duration::from_millis(500),
        tls: Duration::from_millis(600),
        first_byte: Duration::from_millis(600),
    }
}

async fn run(mode: Mode) -> PhaseProbe {
    let port = serve(mode).await;
    probe(
        "localhost",
        LOCALHOST,
        port,
        "/health",
        &trusting_good(),
        quick(),
    )
    .await
}

fn kind_and_phase(report: &PhaseProbe) -> Option<(FailKind, Option<Phase>)> {
    report.fail.as_ref().map(|fail| (fail.kind, fail.phase))
}

#[tokio::test]
async fn a_healthy_server_gets_every_phase_timed() {
    let report = run(Mode::Healthy(120)).await;
    assert_eq!(report.fail, None, "{report:?}");
    assert_eq!(report.status, Some(200));
    assert!(report.first_byte_ms.unwrap() >= 120, "{report:?}");
    assert!(report.tcp_ms.is_some() && report.tls_ms.is_some());
    assert_eq!(report.addr, Some(LOCALHOST));
    assert!(report.passed());
    #[cfg(target_os = "linux")]
    assert!(report.tcp_timestamps.is_some());
}

#[tokio::test]
async fn a_reset_during_the_handshake_is_a_reset_with_its_delay() {
    let report = run(Mode::ResetOnAccept).await;
    assert_eq!(
        kind_and_phase(&report),
        Some((FailKind::Reset, Some(Phase::Tls))),
        "{report:?}"
    );
    assert!(report.fail.unwrap().after_ms.is_some());
}

#[tokio::test]
async fn a_close_after_the_client_hello_is_closed_not_reset() {
    let report = run(Mode::CloseAfterHello).await;
    assert_eq!(
        kind_and_phase(&report),
        Some((FailKind::Closed, Some(Phase::Tls))),
        "{report:?}"
    );
}

#[tokio::test]
async fn silence_after_the_connect_is_a_tls_timeout() {
    let report = run(Mode::Blackhole).await;
    assert_eq!(
        kind_and_phase(&report),
        Some((FailKind::Timeout, Some(Phase::Tls)))
    );
    assert_eq!(report.fail.unwrap().after_ms, Some(600));
    assert!(report.tcp_ms.is_some());
}

#[tokio::test]
async fn a_stall_after_the_handshake_is_a_first_byte_timeout() {
    let report = run(Mode::StallAfterTls).await;
    assert_eq!(
        kind_and_phase(&report),
        Some((FailKind::Timeout, Some(Phase::FirstByte)))
    );
    assert!(report.tls_ms.is_some());
}

#[tokio::test]
async fn a_foreign_certificate_names_its_issuer() {
    let report = run(Mode::WrongCert).await;
    assert_eq!(
        kind_and_phase(&report),
        Some((FailKind::TlsCert, Some(Phase::Tls))),
        "{report:?}"
    );
    assert_eq!(
        report.cert_issuer.as_deref(),
        Some("CN=Test Intercept Root, O=Test Antivirus")
    );
}

#[tokio::test]
async fn a_closed_port_is_refused() {
    let free = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.unwrap();
    let port = free.local_addr().unwrap().port();
    drop(free);
    let report = probe("localhost", LOCALHOST, port, "/", &trusting_good(), quick()).await;
    assert_eq!(
        kind_and_phase(&report),
        Some((FailKind::Refused, Some(Phase::Tcp)))
    );
    assert_eq!(report.tcp_ms, None);
}

#[test]
fn the_status_line_is_parsed() {
    assert_eq!(status_of(b"HTTP/1.1 502 Bad Gateway\r\n"), Some(502));
    assert_eq!(status_of(b"HTTP/2 200\r\n"), Some(200));
    assert_eq!(status_of(b"\x16\x03\x01"), None);
    assert_eq!(status_of(b""), None);
}

#[test]
fn the_public_roots_build() {
    assert!(Tls::public().is_some());
}

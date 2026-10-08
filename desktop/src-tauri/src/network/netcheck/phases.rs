use std::io;
use std::net::{IpAddr, SocketAddr};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use rustls::client::WebPkiServerVerifier;
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::crypto::CryptoProvider;
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{ClientConfig, DigitallySignedStruct, RootCertStore, SignatureScheme};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio_rustls::TlsConnector;

use super::der::issuer_summary;
use super::model::PhaseProbe;
use super::paths::millis;
use super::tcpinfo;
use crate::network::fail::{self, Fail, FailKind, Phase};

const HEAD_BYTES: usize = 64;

#[derive(Clone, Copy, Debug)]
pub struct Budget {
    pub tcp: Duration,
    pub tls: Duration,
    pub first_byte: Duration,
}

impl Default for Budget {
    fn default() -> Self {
        Self {
            tcp: Duration::from_secs(5),
            tls: Duration::from_secs(5),
            first_byte: Duration::from_secs(5),
        }
    }
}

pub struct Tls {
    provider: Arc<CryptoProvider>,
    verifier: Arc<WebPkiServerVerifier>,
}

impl Tls {
    pub fn with_roots(roots: RootCertStore) -> Option<Self> {
        let provider = Arc::new(rustls::crypto::ring::default_provider());
        let verifier =
            WebPkiServerVerifier::builder_with_provider(Arc::new(roots), provider.clone())
                .build()
                .ok()?;
        Some(Self { provider, verifier })
    }

    pub fn public() -> Option<&'static Self> {
        static PUBLIC: OnceLock<Option<Tls>> = OnceLock::new();
        PUBLIC
            .get_or_init(|| {
                let roots =
                    RootCertStore::from_iter(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
                Self::with_roots(roots)
            })
            .as_ref()
    }

    fn config(&self, seen: Arc<Mutex<Option<String>>>) -> Option<Arc<ClientConfig>> {
        let verifier = Arc::new(Recording {
            inner: self.verifier.clone(),
            seen,
        });
        let mut config = ClientConfig::builder_with_provider(self.provider.clone())
            .with_safe_default_protocol_versions()
            .ok()?
            .dangerous()
            .with_custom_certificate_verifier(verifier)
            .with_no_client_auth();
        config.alpn_protocols = vec![b"http/1.1".to_vec()];
        Some(Arc::new(config))
    }
}

#[derive(Debug)]
struct Recording {
    inner: Arc<WebPkiServerVerifier>,
    seen: Arc<Mutex<Option<String>>>,
}

impl ServerCertVerifier for Recording {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        intermediates: &[CertificateDer<'_>],
        server_name: &ServerName<'_>,
        ocsp_response: &[u8],
        now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        let verdict = self.inner.verify_server_cert(
            end_entity,
            intermediates,
            server_name,
            ocsp_response,
            now,
        );
        if verdict.is_err() {
            *self
                .seen
                .lock()
                .unwrap_or_else(|poison| poison.into_inner()) = issuer_summary(end_entity.as_ref());
        }
        verdict
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        self.inner.verify_tls12_signature(message, cert, dss)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        self.inner.verify_tls13_signature(message, cert, dss)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.inner.supported_verify_schemes()
    }
}

fn failed(kind: FailKind, phase: Phase, after_ms: Option<u32>, detail: Option<String>) -> Fail {
    Fail {
        kind,
        phase: Some(phase),
        after_ms,
        detail,
    }
}

fn timed_out(phase: Phase, budget: Duration) -> Fail {
    failed(FailKind::Timeout, phase, Some(millis(budget)), None)
}

pub fn classify(error: &io::Error, phase: Phase, since: Instant) -> Fail {
    let tls = error
        .get_ref()
        .and_then(|inner| inner.downcast_ref::<rustls::Error>());
    if let Some(tls) = tls {
        let kind = match tls {
            rustls::Error::InvalidCertificate(_) => FailKind::TlsCert,
            _ => FailKind::Tls,
        };
        return failed(kind, phase, None, Some(tls.to_string()));
    }
    match fail::of_io(error) {
        Some(kind @ (FailKind::Refused | FailKind::Unreachable)) => failed(kind, phase, None, None),
        Some(kind) => failed(kind, phase, Some(millis(since.elapsed())), None),
        None => failed(FailKind::Other, phase, None, Some(error.to_string())),
    }
}

pub async fn probe(
    host: &str,
    ip: IpAddr,
    port: u16,
    path: &str,
    tls: &Tls,
    budget: Budget,
) -> PhaseProbe {
    let mut report = PhaseProbe {
        addr: Some(ip),
        ..PhaseProbe::default()
    };
    let started = Instant::now();
    let tcp = match tokio::time::timeout(budget.tcp, TcpStream::connect(SocketAddr::new(ip, port)))
        .await
    {
        Err(_) => return fail_with(report, timed_out(Phase::Tcp, budget.tcp)),
        Ok(Err(error)) => return fail_with(report, classify(&error, Phase::Tcp, started)),
        Ok(Ok(stream)) => stream,
    };
    report.tcp_ms = Some(millis(started.elapsed()));
    let _ = tcp.set_nodelay(true);
    if let Some(stats) = tcpinfo::read(&tcp) {
        report.tcp_timestamps = Some(stats.timestamps);
        report.syn_retrans = stats.syn_retrans;
    }

    let seen = Arc::new(Mutex::new(None));
    let (Ok(name), Some(config)) = (
        ServerName::try_from(host.to_string()),
        tls.config(seen.clone()),
    ) else {
        return fail_with(
            report,
            failed(
                FailKind::Other,
                Phase::Tls,
                None,
                Some("bad server name".into()),
            ),
        );
    };
    let started = Instant::now();
    let handshake = TlsConnector::from(config).connect(name, tcp);
    let mut secured = match tokio::time::timeout(budget.tls, handshake).await {
        Err(_) => return fail_with(report, timed_out(Phase::Tls, budget.tls)),
        Ok(Err(error)) => {
            report.cert_issuer = seen
                .lock()
                .unwrap_or_else(|poison| poison.into_inner())
                .take();
            return fail_with(report, classify(&error, Phase::Tls, started));
        }
        Ok(Ok(secured)) => secured,
    };
    report.tls_ms = Some(millis(started.elapsed()));

    let started = Instant::now();
    let request = format!(
        "GET {path} HTTP/1.1\r\nHost: {host}\r\nUser-Agent: soundcloud-desktop-netcheck\r\nAccept: */*\r\nConnection: close\r\n\r\n"
    );
    if let Err(error) = secured.write_all(request.as_bytes()).await {
        return fail_with(report, classify(&error, Phase::FirstByte, started));
    }
    let mut head = [0u8; HEAD_BYTES];
    match tokio::time::timeout(budget.first_byte, secured.read(&mut head)).await {
        Err(_) => fail_with(report, timed_out(Phase::FirstByte, budget.first_byte)),
        Ok(Err(error)) => fail_with(report, classify(&error, Phase::FirstByte, started)),
        Ok(Ok(0)) => {
            let after = Some(millis(started.elapsed()));
            fail_with(
                report,
                failed(FailKind::Closed, Phase::FirstByte, after, None),
            )
        }
        Ok(Ok(read)) => {
            report.first_byte_ms = Some(millis(started.elapsed()));
            report.status = status_of(&head[..read]);
            report
        }
    }
}

fn fail_with(mut report: PhaseProbe, fail: Fail) -> PhaseProbe {
    report.fail = Some(fail);
    report
}

pub fn status_of(head: &[u8]) -> Option<u16> {
    let line = String::from_utf8_lossy(head);
    let mut parts = line.split_whitespace();
    parts
        .next()
        .filter(|version| version.starts_with("HTTP/"))?;
    parts.next()?.parse().ok()
}

#[cfg(test)]
#[path = "phases_tests.rs"]
mod tests;

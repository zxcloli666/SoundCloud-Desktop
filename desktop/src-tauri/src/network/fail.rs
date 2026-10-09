use std::error::Error as StdError;
use std::fmt;
use std::io;

use serde::{Deserialize, Serialize};

use super::dns::DnsError;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FailKind {
    Dns,
    DnsBogus,
    Timeout,
    Refused,
    Unreachable,
    Reset,
    Closed,
    TlsCert,
    Tls,
    Status,
    Body,
    Other,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
    Dns,
    Tcp,
    Tls,
    FirstByte,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Fail {
    pub kind: FailKind,
    pub phase: Option<Phase>,
    pub after_ms: Option<u32>,
    pub detail: Option<String>,
}

impl FailKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Dns => "dns",
            Self::DnsBogus => "dns_bogus",
            Self::Timeout => "timeout",
            Self::Refused => "refused",
            Self::Unreachable => "unreachable",
            Self::Reset => "reset",
            Self::Closed => "closed",
            Self::TlsCert => "tls_cert",
            Self::Tls => "tls",
            Self::Status => "status",
            Self::Body => "body",
            Self::Other => "other",
        }
    }
}

impl Phase {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Dns => "dns",
            Self::Tcp => "tcp",
            Self::Tls => "tls",
            Self::FirstByte => "first byte",
        }
    }
}

impl Fail {
    pub fn of(kind: FailKind) -> Self {
        Self {
            kind,
            phase: None,
            after_ms: None,
            detail: None,
        }
    }

    pub fn timeout_after(ms: u32) -> Self {
        Self {
            after_ms: Some(ms),
            ..Self::of(FailKind::Timeout)
        }
    }

    pub fn of_wreq(err: &wreq::Error) -> Self {
        Self {
            detail: Some(err.to_string()),
            ..Self::of(of_wreq(err))
        }
    }
}

impl fmt::Display for Fail {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.kind.as_str())?;
        if let Some(ms) = self.after_ms {
            write!(f, " after {ms} ms")?;
        }
        if let Some(phase) = self.phase {
            write!(f, " in {}", phase.as_str())?;
        }
        if let Some(detail) = &self.detail {
            write!(f, ": {detail}")?;
        }
        Ok(())
    }
}

pub fn of_io(err: &io::Error) -> Option<FailKind> {
    match err.kind() {
        io::ErrorKind::ConnectionRefused => Some(FailKind::Refused),
        io::ErrorKind::ConnectionReset
        | io::ErrorKind::ConnectionAborted
        | io::ErrorKind::BrokenPipe => Some(FailKind::Reset),
        io::ErrorKind::UnexpectedEof => Some(FailKind::Closed),
        io::ErrorKind::TimedOut => Some(FailKind::Timeout),
        io::ErrorKind::HostUnreachable | io::ErrorKind::NetworkUnreachable => {
            Some(FailKind::Unreachable)
        }
        _ => None,
    }
}

pub fn of_text(text: &str) -> Option<FailKind> {
    let text = text.to_ascii_lowercase();
    let has = |needles: &[&str]| needles.iter().any(|needle| text.contains(needle));
    if has(&["certificate"]) {
        Some(FailKind::TlsCert)
    } else if has(&["ssl", "tls", "handshake"]) || has_tls_reason(&text) {
        Some(FailKind::Tls)
    } else if has(&["dns error", "failed to lookup", "no such host"]) {
        Some(FailKind::Dns)
    } else if has(&["connection closed before message completed"]) {
        Some(FailKind::Closed)
    } else if has(&["timed out"]) {
        Some(FailKind::Timeout)
    } else {
        None
    }
}

fn has_tls_reason(text: &str) -> bool {
    text.split('[').skip(1).any(|rest| {
        rest.split_once(']').is_some_and(|(reason, _)| {
            reason.contains('_')
                && reason
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '_')
        })
    })
}

pub fn of_wreq(err: &wreq::Error) -> FailKind {
    let mut text = String::new();
    let mut source = err.source();
    while let Some(cause) = source {
        if let Some(dns) = cause.downcast_ref::<DnsError>() {
            return dns.kind;
        }
        if let Some(kind) = cause.downcast_ref::<io::Error>().and_then(of_io) {
            return kind;
        }
        text.push_str(&cause.to_string());
        text.push('\n');
        source = cause.source();
    }
    if err.is_timeout() {
        return FailKind::Timeout;
    }
    if let Some(kind) = of_text(&text) {
        return kind;
    }
    if err.is_body() || err.is_decode() {
        return FailKind::Body;
    }
    FailKind::Other
}

#[cfg(test)]
mod tests {
    use std::error::Error as StdError;
    use std::io;
    use std::sync::Arc;
    use std::time::Duration;

    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    use super::{DnsError, Fail, FailKind, Phase, of_io, of_text, of_wreq};

    #[test]
    fn io_kinds_map_to_failure_classes() {
        let table = [
            (io::ErrorKind::ConnectionRefused, Some(FailKind::Refused)),
            (io::ErrorKind::ConnectionReset, Some(FailKind::Reset)),
            (io::ErrorKind::ConnectionAborted, Some(FailKind::Reset)),
            (io::ErrorKind::BrokenPipe, Some(FailKind::Reset)),
            (io::ErrorKind::UnexpectedEof, Some(FailKind::Closed)),
            (io::ErrorKind::TimedOut, Some(FailKind::Timeout)),
            (io::ErrorKind::HostUnreachable, Some(FailKind::Unreachable)),
            (
                io::ErrorKind::NetworkUnreachable,
                Some(FailKind::Unreachable),
            ),
            (io::ErrorKind::PermissionDenied, None),
        ];
        for (kind, expected) in table {
            assert_eq!(of_io(&io::Error::from(kind)), expected, "{kind:?}");
        }
    }

    #[test]
    fn error_texts_map_to_failure_classes() {
        let table = [
            ("certificate verify failed", Some(FailKind::TlsCert)),
            (
                "SSL routines:OPENSSL_internal:WRONG_VERSION_NUMBER",
                Some(FailKind::Tls),
            ),
            ("TLS handshake eof", Some(FailKind::Tls)),
            (
                "dns error: failed to lookup address information",
                Some(FailKind::Dns),
            ),
            (
                "No such host is known. (os error 11001)",
                Some(FailKind::Dns),
            ),
            (
                "connection closed before message completed",
                Some(FailKind::Closed),
            ),
            (
                "http2 error: keep-alive timed out: operation timed out",
                Some(FailKind::Timeout),
            ),
            ("TLS handshake timed out", Some(FailKind::Tls)),
            (
                "client error (Connect)\n[WRONG_VERSION_NUMBER]\n",
                Some(FailKind::Tls),
            ),
            ("[CERTIFICATE_VERIFY_FAILED]", Some(FailKind::TlsCert)),
            ("connect to [::1]:443 failed", None),
            ("connection error: unexpected end of file", None),
        ];
        for (text, expected) in table {
            assert_eq!(of_text(text), expected, "{text}");
        }
    }

    #[test]
    fn a_failure_reads_as_one_line() {
        let fail = Fail {
            kind: FailKind::Reset,
            phase: Some(Phase::Tls),
            after_ms: Some(12),
            detail: None,
        };
        assert_eq!(fail.to_string(), "reset after 12 ms in tls");
        assert_eq!(
            Fail::timeout_after(5000).to_string(),
            "timeout after 5000 ms"
        );
        assert_eq!(FailKind::DnsBogus.as_str(), "dns_bogus");
        assert_eq!(
            serde_json::to_string(&FailKind::TlsCert).unwrap(),
            "\"tlsCert\""
        );
    }

    fn client() -> wreq::Client {
        wreq::Client::builder().no_proxy().build().unwrap()
    }

    async fn error_from(url: String, timeout: Duration) -> wreq::Error {
        client()
            .get(url)
            .timeout(timeout)
            .send()
            .await
            .expect_err("the request must fail")
    }

    #[tokio::test]
    async fn a_closed_port_is_refused() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        drop(listener);
        let err = error_from(format!("http://{addr}/"), Duration::from_secs(5)).await;
        assert_eq!(of_wreq(&err), FailKind::Refused);
    }

    #[tokio::test]
    async fn an_abortive_close_is_a_reset() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut buf = [0u8; 1024];
            let _ = stream.read(&mut buf).await;
            stream.set_zero_linger().unwrap();
            drop(stream);
        });
        let err = error_from(format!("http://{addr}/"), Duration::from_secs(5)).await;
        assert_eq!(of_wreq(&err), FailKind::Reset);
    }

    #[tokio::test]
    async fn a_close_after_the_request_is_closed() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut raw = Vec::new();
            let mut buf = [0u8; 1024];
            while !raw.windows(4).any(|w| w == b"\r\n\r\n") {
                let read = stream.read(&mut buf).await.unwrap_or(0);
                if read == 0 {
                    break;
                }
                raw.extend_from_slice(&buf[..read]);
            }
            let _ = stream.shutdown().await;
            tokio::time::sleep(Duration::from_secs(2)).await;
        });
        let err = error_from(format!("http://{addr}/"), Duration::from_secs(5)).await;
        assert_eq!(of_wreq(&err), FailKind::Closed, "{err:?}");
    }

    #[tokio::test]
    async fn tls_against_a_plain_http_server_is_a_tls_failure() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut buf = [0u8; 1024];
            let _ = stream.read(&mut buf).await;
            let _ = stream
                .write_all(b"HTTP/1.1 400 Bad Request\r\ncontent-length: 0\r\n\r\n")
                .await;
            tokio::time::sleep(Duration::from_secs(2)).await;
        });
        let err = error_from(format!("https://{addr}/"), Duration::from_secs(5)).await;
        assert_eq!(of_wreq(&err), FailKind::Tls, "{err:?}");
    }

    #[tokio::test]
    async fn a_silent_server_is_a_timeout() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            tokio::time::sleep(Duration::from_secs(5)).await;
            drop(stream);
        });
        let err = error_from(format!("http://{addr}/"), Duration::from_millis(300)).await;
        assert_eq!(of_wreq(&err), FailKind::Timeout);
    }

    struct Refusing(FailKind);

    impl wreq::dns::Resolve for Refusing {
        fn resolve(&self, name: wreq::dns::Name) -> wreq::dns::Resolving {
            let error: Box<dyn StdError + Send + Sync> = Box::new(DnsError {
                kind: self.0,
                host: name.as_str().to_string(),
                reason: "no answer".to_string(),
            });
            Box::pin(async move { Err(error) })
        }
    }

    #[tokio::test]
    async fn a_resolver_failure_keeps_its_own_kind() {
        for kind in [FailKind::Dns, FailKind::DnsBogus] {
            let client = wreq::Client::builder()
                .no_proxy()
                .dns_resolver(Arc::new(Refusing(kind)))
                .build()
                .unwrap();
            let err = client
                .get("http://api.scnative.space/health")
                .send()
                .await
                .expect_err("the lookup must fail");
            assert_eq!(of_wreq(&err), kind);
        }
    }
}

use std::time::Duration;

use super::model::{TargetCheck, TargetId, Trigger, VolumeProbe};
use super::targets::Target;
use crate::network::health::link::{self, Measured, Shape};
use crate::network::pro;
use crate::network::{dns, edge};

const PROBE_PATH: &str = "/probe";
const CARRIER_SERVICE: &str = "storage";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

pub fn size(trigger: Trigger) -> u64 {
    match trigger {
        Trigger::Manual => link::DEEP_BYTES,
        Trigger::Auto => link::PROBE_BYTES,
    }
}

pub async fn of(target: &Target, size: u64) -> Option<VolumeProbe> {
    match target.id {
        TargetId::Pro => Some(in_pieces(&target.host, size).await),
        TargetId::Relay => {
            let node = target.node.as_deref()?;
            let url = format!(
                "https://{}{PROBE_PATH}",
                edge::relay_host(CARRIER_SERVICE, node)
            );
            Some(measure(&client()?, &url, size).await)
        }
        TargetId::Images => {
            let carrier = format!("https://{}/", target.host);
            let storage = edge::primary_relay_host(CARRIER_SERVICE);
            let probe = format!("https://{storage}{PROBE_PATH}");
            Some(measure_through(&client()?, &probe, size, Some(&carrier)).await)
        }
        TargetId::Call | TargetId::SoundCloud => None,
    }
}

pub fn primary(targets: &[TargetCheck]) -> Option<VolumeProbe> {
    targets
        .iter()
        .find(|target| target.id == TargetId::Relay)
        .and_then(|target| target.volume.clone())
}

pub fn of_kind(targets: &[TargetCheck], id: TargetId) -> Vec<VolumeProbe> {
    targets
        .iter()
        .filter(|target| target.id == id)
        .filter_map(|target| target.volume.clone())
        .collect()
}

async fn in_pieces(host: &str, size: u64) -> VolumeProbe {
    let carried = pro::carries_sized(host, usize::try_from(size).unwrap_or(usize::MAX)).await;
    let shape = if carried.ok {
        Shape::Clear
    } else {
        Shape::Dead
    };
    let bytes = carried.bytes as u64;
    VolumeProbe {
        host: host.to_string(),
        shape: shape.as_str().to_string(),
        bytes,
        ms: carried.ms,
        cut: !carried.ok,
        speed: per_second(bytes, carried.ms),
    }
}

fn client() -> Option<wreq::Client> {
    dns::install(sc_fingerprint::builder(None))
        .no_proxy()
        .pool_max_idle_per_host(0)
        .connect_timeout(CONNECT_TIMEOUT)
        .build()
        .ok()
}

async fn measure(client: &wreq::Client, url: &str, size: u64) -> VolumeProbe {
    measure_through(client, url, size, None).await
}

async fn measure_through(
    client: &wreq::Client,
    url: &str,
    size: u64,
    carrier: Option<&str>,
) -> VolumeProbe {
    let measured = link::probe_through(client, url, size, carrier).await;
    let bytes = u64::try_from(measured.link.bytes).unwrap_or_default();
    let cut = cut(measured.shape, bytes, size)
        || (measured.connected
            && silent(measured.shape, bytes)
            && small_passes(client, url, carrier).await);
    VolumeProbe {
        host: url::Url::parse(carrier.unwrap_or(url))
            .ok()
            .and_then(|url| url.host_str().map(str::to_string))
            .unwrap_or_default(),
        shape: measured.shape.as_str().to_string(),
        bytes,
        ms: u32::try_from(measured.ms).unwrap_or_default(),
        cut,
        speed: speed(&measured),
    }
}

fn speed(measured: &Measured) -> u64 {
    if !measured.shape.usable() {
        return 0;
    }
    match measured.sustained_bps() / 8 {
        0 => u64::try_from(measured.link.kbps).unwrap_or_default() * 125,
        sustained => sustained,
    }
}

fn per_second(bytes: u64, ms: u32) -> u64 {
    if ms == 0 {
        0
    } else {
        bytes * 1000 / u64::from(ms)
    }
}

fn silent(shape: Shape, bytes: u64) -> bool {
    shape == Shape::Blackhole && bytes < link::CUT_FLOOR
}

async fn small_passes(client: &wreq::Client, url: &str, carrier: Option<&str>) -> bool {
    link::probe_through(client, url, link::SMALL_BYTES, carrier)
        .await
        .shape
        .usable()
}

fn cut(shape: Shape, bytes: u64, size: u64) -> bool {
    matches!(shape, Shape::Cut | Shape::Blackhole) && (link::CUT_FLOOR..size).contains(&bytes)
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    use super::{cut, measure, per_second, silent};
    use crate::network::h2_server::acceptor;
    use crate::network::health::link::{DEEP_BYTES, PROBE_BYTES, SMALL_BYTES, Shape};

    #[derive(Clone, Copy)]
    enum Ending {
        Whole,
        Close,
        Freeze,
        Missing,
    }

    const SENT_BEFORE_CUT: usize = 12_000;

    async fn server(ending: Ending) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let Ok((mut socket, _)) = listener.accept().await else {
                return;
            };
            let mut buf = [0u8; 2048];
            let _ = socket.read(&mut buf).await;
            if matches!(ending, Ending::Missing) {
                let _ = socket
                    .write_all(b"HTTP/1.1 404 Not Found\r\ncontent-length: 0\r\n\r\n")
                    .await;
                return;
            }
            let head = format!("HTTP/1.1 200 OK\r\ncontent-length: {PROBE_BYTES}\r\n\r\n");
            let _ = socket.write_all(head.as_bytes()).await;
            let sent = match ending {
                Ending::Whole => PROBE_BYTES as usize,
                Ending::Close | Ending::Freeze | Ending::Missing => SENT_BEFORE_CUT,
            };
            let _ = socket.write_all(&vec![b'x'; sent]).await;
            if matches!(ending, Ending::Freeze) {
                tokio::time::sleep(Duration::from_secs(30)).await;
            }
        });
        format!("http://{addr}/probe")
    }

    async fn picky_server(small_too: bool) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            while let Ok((mut socket, _)) = listener.accept().await {
                tokio::spawn(async move {
                    let mut buf = [0u8; 2048];
                    let read = socket.read(&mut buf).await.unwrap_or(0);
                    let small = String::from_utf8_lossy(&buf[..read])
                        .contains(&format!("bytes={SMALL_BYTES} "));
                    let size = if small { SMALL_BYTES } else { PROBE_BYTES };
                    let head = format!("HTTP/1.1 200 OK\r\ncontent-length: {size}\r\n\r\n");
                    let _ = socket.write_all(head.as_bytes()).await;
                    if small && !small_too {
                        let _ = socket.write_all(&vec![b'x'; size as usize]).await;
                    }
                    tokio::time::sleep(Duration::from_secs(30)).await;
                });
            }
        });
        format!("http://{addr}/probe")
    }

    async fn lossy_tls_server() -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let acceptor = acceptor(&[]);
        tokio::spawn(async move {
            let mut lost = true;
            while let Ok((socket, _)) = listener.accept().await {
                let first = std::mem::replace(&mut lost, false);
                let acceptor = acceptor.clone();
                tokio::spawn(async move {
                    if first {
                        let _held = socket;
                        tokio::time::sleep(Duration::from_secs(30)).await;
                        return;
                    }
                    let Ok(mut stream) = acceptor.accept(socket).await else {
                        return;
                    };
                    let mut buf = [0u8; 2048];
                    let read = stream.read(&mut buf).await.unwrap_or(0);
                    let small = String::from_utf8_lossy(&buf[..read])
                        .contains(&format!("bytes={SMALL_BYTES} "));
                    let size = if small { SMALL_BYTES } else { PROBE_BYTES };
                    let head = format!("HTTP/1.1 200 OK\r\ncontent-length: {size}\r\n\r\n");
                    let _ = stream.write_all(head.as_bytes()).await;
                    let _ = stream.write_all(&vec![b'x'; size as usize]).await;
                    let _ = stream.flush().await;
                    tokio::time::sleep(Duration::from_secs(1)).await;
                });
            }
        });
        format!("https://{addr}/probe")
    }

    fn client() -> wreq::Client {
        wreq::Client::builder().no_proxy().build().unwrap()
    }

    #[tokio::test]
    async fn a_whole_body_is_not_a_cut() {
        let volume = measure(&client(), &server(Ending::Whole).await, PROBE_BYTES).await;
        assert_eq!(volume.shape, "clear");
        assert_eq!(volume.bytes, PROBE_BYTES);
        assert!(!volume.cut);
    }

    #[tokio::test]
    async fn a_body_that_breaks_off_after_twelve_kilobytes_is_a_cut() {
        let volume = measure(&client(), &server(Ending::Close).await, PROBE_BYTES).await;
        assert_eq!(volume.bytes, SENT_BEFORE_CUT as u64);
        assert!(volume.cut, "{volume:?}");
    }

    #[tokio::test]
    async fn a_body_that_freezes_after_twelve_kilobytes_is_a_cut() {
        let volume = measure(&client(), &server(Ending::Freeze).await, PROBE_BYTES).await;
        assert_eq!(volume.shape, "blackhole");
        assert_eq!(volume.bytes, SENT_BEFORE_CUT as u64);
        assert!(volume.cut, "{volume:?}");
    }

    #[tokio::test]
    async fn a_big_answer_that_never_starts_while_a_small_one_passes_is_a_cut() {
        let volume = measure(&client(), &picky_server(false).await, PROBE_BYTES).await;
        assert_eq!(volume.shape, "blackhole");
        assert_eq!(volume.bytes, 0);
        assert!(volume.cut, "{volume:?}");
    }

    #[tokio::test]
    async fn a_handshake_lost_to_packet_loss_is_not_a_cut() {
        let client = wreq::Client::builder()
            .no_proxy()
            .tls_cert_verification(false)
            .connect_timeout(Duration::from_millis(500))
            .pool_max_idle_per_host(0)
            .build()
            .unwrap();
        let volume = measure(&client, &lossy_tls_server().await, PROBE_BYTES).await;
        assert_eq!(volume.shape, "blackhole");
        assert_eq!(volume.bytes, 0);
        assert!(!volume.cut, "{volume:?}");
    }

    #[tokio::test]
    async fn a_host_that_stalls_every_answer_is_not_a_cut() {
        let volume = measure(&client(), &picky_server(true).await, PROBE_BYTES).await;
        assert_eq!(volume.shape, "blackhole");
        assert!(!volume.cut, "{volume:?}");
    }

    #[tokio::test]
    async fn a_whole_body_gets_a_speed_and_a_missing_probe_is_dead() {
        let volume = measure(&client(), &server(Ending::Whole).await, PROBE_BYTES).await;
        assert!(volume.speed > 0, "{volume:?}");
        assert_eq!(volume.host, "127.0.0.1");
        let missing = measure(&client(), &server(Ending::Missing).await, PROBE_BYTES).await;
        assert_eq!(missing.shape, "dead");
        assert_eq!(missing.speed, 0);
        assert!(!missing.cut);
    }

    #[test]
    fn pieces_get_a_speed_from_their_bytes_and_time() {
        assert_eq!(per_second(64 * 1024, 500), 131_072);
        assert_eq!(per_second(64 * 1024, 0), 0);
    }

    #[tokio::test]
    async fn a_server_that_never_answers_is_not_a_cut() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/probe", listener.local_addr().unwrap());
        drop(listener);
        let volume = measure(&client(), &url, PROBE_BYTES).await;
        assert_eq!(volume.bytes, 0);
        assert!(!volume.cut);
    }

    #[test]
    fn only_a_silent_blackhole_asks_for_the_small_probe() {
        assert!(silent(Shape::Blackhole, 0));
        assert!(!silent(Shape::Blackhole, 9 * 1024));
        assert!(!silent(Shape::Reset, 0));
        assert!(!silent(Shape::Dead, 0));
    }

    #[test]
    fn only_a_stop_inside_the_body_counts() {
        assert!(cut(Shape::Cut, 9 * 1024, PROBE_BYTES));
        assert!(cut(Shape::Blackhole, 16 * 1024, PROBE_BYTES));
        assert!(cut(Shape::Cut, 100 * 1024, DEEP_BYTES));
        assert!(!cut(Shape::Cut, 100 * 1024, PROBE_BYTES));
        assert!(!cut(Shape::Blackhole, 0, PROBE_BYTES));
        assert!(!cut(Shape::Reset, 1024, PROBE_BYTES));
        assert!(!cut(Shape::Clear, PROBE_BYTES, PROBE_BYTES));
        assert!(!cut(Shape::Slow, 20 * 1024, PROBE_BYTES));
    }
}

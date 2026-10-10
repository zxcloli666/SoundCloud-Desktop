use std::time::Duration;

use super::model::{TargetCheck, TargetId, VolumeProbe};
use super::targets::Target;
use crate::network::dns;
use crate::network::health::link::{self, Shape};
use crate::network::pro;

const STORAGE_PROBE: &str = "https://storage.scnative.space/probe";
const HEALTH_PROBE: &str = "https://health.scnative.space/probe";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

pub async fn of(target: &Target) -> Option<VolumeProbe> {
    if target.id == TargetId::Pro {
        return Some(in_pieces(&target.host).await);
    }
    let client = client()?;
    let host = &target.host;
    let volume = match target.id {
        TargetId::Images => {
            let carrier = format!("https://{host}/");
            measure_through(&client, STORAGE_PROBE, Some(&carrier)).await
        }
        _ => measure(&client, &format!("https://{host}/probe")).await,
    };
    Some(volume)
}

pub async fn direct(targets: &[TargetCheck]) -> Option<VolumeProbe> {
    let storage = targets
        .iter()
        .find(|target| target.id == TargetId::Storage)
        .and_then(|target| target.volume.clone());
    match storage {
        Some(volume) if volume.shape != Shape::Dead.as_str() => Some(volume),
        storage => match client() {
            Some(client) => first_served(&client, &[HEALTH_PROBE]).await,
            None => storage,
        },
    }
}

pub fn of_kind(targets: &[TargetCheck], id: TargetId) -> Vec<VolumeProbe> {
    targets
        .iter()
        .filter(|target| target.id == id)
        .filter_map(|target| target.volume.clone())
        .collect()
}

async fn in_pieces(host: &str) -> VolumeProbe {
    let carried = pro::carries(host).await;
    let shape = if carried.ok {
        Shape::Clear
    } else {
        Shape::Dead
    };
    VolumeProbe {
        host: host.to_string(),
        shape: shape.as_str().to_string(),
        bytes: carried.bytes as u64,
        ms: carried.ms,
        cut: !carried.ok,
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

async fn first_served(client: &wreq::Client, urls: &[&str]) -> Option<VolumeProbe> {
    let mut last = None;
    for url in urls {
        let volume = measure(client, url).await;
        if volume.shape != Shape::Dead.as_str() {
            return Some(volume);
        }
        last = Some(volume);
    }
    last
}

async fn measure(client: &wreq::Client, url: &str) -> VolumeProbe {
    measure_through(client, url, None).await
}

async fn measure_through(client: &wreq::Client, url: &str, carrier: Option<&str>) -> VolumeProbe {
    let measured = link::probe_through(client, url, link::PROBE_BYTES, carrier).await;
    let bytes = u64::try_from(measured.link.bytes).unwrap_or_default();
    let cut = cut(measured.shape, bytes)
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

fn cut(shape: Shape, bytes: u64) -> bool {
    matches!(shape, Shape::Cut | Shape::Blackhole)
        && (link::CUT_FLOOR..link::PROBE_BYTES).contains(&bytes)
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    use super::{cut, first_served, measure, silent};
    use crate::network::h2_server::acceptor;
    use crate::network::health::link::{PROBE_BYTES, SMALL_BYTES, Shape};

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
        let volume = measure(&client(), &server(Ending::Whole).await).await;
        assert_eq!(volume.shape, "clear");
        assert_eq!(volume.bytes, PROBE_BYTES);
        assert!(!volume.cut);
    }

    #[tokio::test]
    async fn a_body_that_breaks_off_after_twelve_kilobytes_is_a_cut() {
        let volume = measure(&client(), &server(Ending::Close).await).await;
        assert_eq!(volume.bytes, SENT_BEFORE_CUT as u64);
        assert!(volume.cut, "{volume:?}");
    }

    #[tokio::test]
    async fn a_body_that_freezes_after_twelve_kilobytes_is_a_cut() {
        let volume = measure(&client(), &server(Ending::Freeze).await).await;
        assert_eq!(volume.shape, "blackhole");
        assert_eq!(volume.bytes, SENT_BEFORE_CUT as u64);
        assert!(volume.cut, "{volume:?}");
    }

    #[tokio::test]
    async fn a_big_answer_that_never_starts_while_a_small_one_passes_is_a_cut() {
        let volume = measure(&client(), &picky_server(false).await).await;
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
        let volume = measure(&client, &lossy_tls_server().await).await;
        assert_eq!(volume.shape, "blackhole");
        assert_eq!(volume.bytes, 0);
        assert!(!volume.cut, "{volume:?}");
    }

    #[tokio::test]
    async fn a_host_that_stalls_every_answer_is_not_a_cut() {
        let volume = measure(&client(), &picky_server(true).await).await;
        assert_eq!(volume.shape, "blackhole");
        assert!(!volume.cut, "{volume:?}");
    }

    #[tokio::test]
    async fn the_storage_origin_is_measured_first_and_named() {
        let storage = server(Ending::Close).await;
        let health = server(Ending::Whole).await;
        let volume = first_served(&client(), &[&storage, &health]).await.unwrap();
        assert!(volume.cut, "{volume:?}");
        assert_eq!(volume.host, "127.0.0.1");
        assert_eq!(volume.bytes, SENT_BEFORE_CUT as u64);
    }

    #[tokio::test]
    async fn an_origin_without_the_probe_gives_way_to_the_next() {
        let storage = server(Ending::Missing).await;
        let health = server(Ending::Whole).await;
        let volume = first_served(&client(), &[&storage, &health]).await.unwrap();
        assert_eq!(volume.shape, "clear");
        assert_eq!(volume.bytes, PROBE_BYTES);
        let missing = server(Ending::Missing).await;
        let volume = first_served(&client(), &[&missing]).await.unwrap();
        assert_eq!(volume.shape, "dead");
        assert!(!volume.cut);
    }

    #[tokio::test]
    async fn a_server_that_never_answers_is_not_a_cut() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/probe", listener.local_addr().unwrap());
        drop(listener);
        let volume = measure(&client(), &url).await;
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
        assert!(cut(Shape::Cut, 9 * 1024));
        assert!(cut(Shape::Blackhole, 16 * 1024));
        assert!(!cut(Shape::Blackhole, 0));
        assert!(!cut(Shape::Reset, 1024));
        assert!(!cut(Shape::Clear, PROBE_BYTES));
        assert!(!cut(Shape::Slow, 20 * 1024));
    }
}

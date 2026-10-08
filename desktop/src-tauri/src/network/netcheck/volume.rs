use std::time::Duration;

use super::model::VolumeProbe;
use crate::network::dns;
use crate::network::health::link::{self, Shape};

const PROBE_URLS: [&str; 2] = [
    "https://storage.scnative.space/probe",
    "https://health.scnative.space/probe",
];
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

pub async fn probe() -> Option<VolumeProbe> {
    let client = dns::install(sc_fingerprint::builder(None))
        .no_proxy()
        .pool_max_idle_per_host(0)
        .connect_timeout(CONNECT_TIMEOUT)
        .build()
        .ok()?;
    first_served(&client, &PROBE_URLS).await
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
    let measured = link::probe(client, url, link::PROBE_BYTES).await;
    let bytes = u64::try_from(measured.link.bytes).unwrap_or_default();
    VolumeProbe {
        host: url::Url::parse(url)
            .ok()
            .and_then(|url| url.host_str().map(str::to_string))
            .unwrap_or_default(),
        shape: measured.shape.as_str().to_string(),
        bytes,
        ms: u32::try_from(measured.ms).unwrap_or_default(),
        cut: cut(measured.shape, bytes),
    }
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

    use super::{cut, first_served, measure};
    use crate::network::health::link::{PROBE_BYTES, Shape};

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
    fn only_a_stop_inside_the_body_counts() {
        assert!(cut(Shape::Cut, 9 * 1024));
        assert!(cut(Shape::Blackhole, 16 * 1024));
        assert!(!cut(Shape::Blackhole, 0));
        assert!(!cut(Shape::Reset, 1024));
        assert!(!cut(Shape::Clear, PROBE_BYTES));
        assert!(!cut(Shape::Slow, 20 * 1024));
    }
}

use std::time::Duration;

use super::model::VolumeProbe;
use crate::network::dns;
use crate::network::health::link::{self, Shape};

const PROBE_URL: &str = "https://health.scnative.space/probe";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

pub async fn probe() -> Option<VolumeProbe> {
    let client = dns::install(sc_fingerprint::builder(None))
        .no_proxy()
        .pool_max_idle_per_host(0)
        .connect_timeout(CONNECT_TIMEOUT)
        .build()
        .ok()?;
    Some(measure(&client, PROBE_URL).await)
}

async fn measure(client: &wreq::Client, url: &str) -> VolumeProbe {
    let measured = link::probe(client, url, link::PROBE_BYTES).await;
    let bytes = u64::try_from(measured.link.bytes).unwrap_or_default();
    VolumeProbe {
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

    use super::{cut, measure};
    use crate::network::health::link::{PROBE_BYTES, Shape};

    #[derive(Clone, Copy)]
    enum Ending {
        Whole,
        Close,
        Freeze,
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
            let head = format!("HTTP/1.1 200 OK\r\ncontent-length: {PROBE_BYTES}\r\n\r\n");
            let _ = socket.write_all(head.as_bytes()).await;
            let sent = match ending {
                Ending::Whole => PROBE_BYTES as usize,
                Ending::Close | Ending::Freeze => SENT_BEFORE_CUT,
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

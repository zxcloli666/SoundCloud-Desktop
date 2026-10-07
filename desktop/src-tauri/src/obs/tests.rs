use std::net::TcpListener;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use super::snapshot::NowPlaying;
use super::state::{ObsConfig, ObsState, ServerStatus};

fn free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .expect("free port")
}

fn config(server: bool, port: u16, txt_path: Option<String>) -> ObsConfig {
    ObsConfig {
        server,
        port,
        txt_path,
        template: "{artist} - {title}".into(),
    }
}

fn playing() -> NowPlaying {
    NowPlaying {
        has_track: true,
        title: "Midnight City".into(),
        artist: "M83".into(),
        artwork_url: Some("https://i1.sndcdn.com/artworks-x-t500x500.jpg".into()),
        duration_ms: 243_000,
        position_ms: 12_000,
        playing: true,
        accent: "#ff5500".into(),
        ..NowPlaying::default()
    }
}

async fn get(port: u16, path: &str) -> String {
    let mut stream = TcpStream::connect(("127.0.0.1", port))
        .await
        .expect("connect");
    let request = format!("GET {path} HTTP/1.0\r\nHost: 127.0.0.1:{port}\r\n\r\n");
    stream.write_all(request.as_bytes()).await.expect("write");
    let mut response = String::new();
    stream.read_to_string(&mut response).await.expect("read");
    response
}

#[tokio::test]
async fn serves_now_playing() {
    let state = ObsState::default();
    let port = free_port();
    let status = state.configure(config(true, port, None)).await;
    assert_eq!(status.server, ServerStatus::Running);

    state.update(playing()).await;

    let json = get(port, "/np.json").await;
    assert!(json.contains("\"title\":\"Midnight City\""));
    assert!(json.contains("\"playing\":true"));
    assert!(json.contains(&format!("http://127.0.0.1:{port}/cover?v=")));
    assert!(!json.contains("coverKey"));

    let text = get(port, "/np.txt").await;
    assert!(text.ends_with("M83 - Midnight City"));

    let overlay = get(port, "/overlay").await;
    assert!(overlay.contains("text/html"));
    assert!(overlay.contains("EventSource"));

    let stopped = state.configure(config(false, port, None)).await;
    assert_eq!(stopped.server, ServerStatus::Off);
}

#[tokio::test]
async fn reports_busy_port() {
    let taken = TcpListener::bind("127.0.0.1:0").expect("bind");
    let port = taken.local_addr().expect("addr").port();
    let state = ObsState::default();
    let status = state.configure(config(true, port, None)).await;
    assert_eq!(status.server, ServerStatus::Busy);
}

#[tokio::test]
async fn writes_text_file_on_change() {
    let dir = std::env::temp_dir().join(format!("sc-obs-{}", std::process::id()));
    std::fs::create_dir_all(&dir).expect("dir");
    let path = dir.join("now-playing.txt");
    let state = ObsState::default();
    let status = state
        .configure(config(false, 0, Some(path.to_string_lossy().into_owned())))
        .await;
    assert_eq!(status.txt_error, None);

    state.update(playing()).await;
    assert_eq!(
        std::fs::read_to_string(&path).expect("read"),
        "M83 - Midnight City"
    );

    state.update(NowPlaying::default()).await;
    assert_eq!(std::fs::read_to_string(&path).expect("read"), "");

    let missing = dir.join("missing").join("np.txt");
    let failed = state
        .configure(config(
            false,
            0,
            Some(missing.to_string_lossy().into_owned()),
        ))
        .await;
    assert!(failed.txt_error.is_some());

    std::fs::remove_dir_all(&dir).ok();
}

#[tokio::test]
async fn streams_updates_over_sse() {
    let state = ObsState::default();
    let port = free_port();
    state.configure(config(true, port, None)).await;
    state.update(playing()).await;

    let mut stream = TcpStream::connect(("127.0.0.1", port))
        .await
        .expect("connect");
    let request = format!("GET /events HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n\r\n");
    stream.write_all(request.as_bytes()).await.expect("write");

    let mut received = String::new();
    let mut buf = [0u8; 4096];
    while !received.contains("Midnight City") {
        let n = stream.read(&mut buf).await.expect("read");
        assert!(n > 0, "stream closed early");
        received.push_str(&String::from_utf8_lossy(&buf[..n]));
    }
    assert!(received.contains("text/event-stream"));

    state
        .update(NowPlaying {
            title: "Wait".into(),
            ..playing()
        })
        .await;
    while !received.contains("\"title\":\"Wait\"") {
        let n = stream.read(&mut buf).await.expect("read");
        assert!(n > 0, "stream closed early");
        received.push_str(&String::from_utf8_lossy(&buf[..n]));
    }

    state.configure(config(false, port, None)).await;
    let closed = tokio::time::timeout(std::time::Duration::from_secs(3), async {
        while stream.read(&mut buf).await.map(|n| n > 0).unwrap_or(false) {}
    })
    .await;
    assert!(
        closed.is_ok(),
        "event stream must end when the server stops"
    );
}

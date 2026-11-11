use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;

use bytes::Bytes;
use futures_util::StreamExt;
use tokio::sync::watch;
use warp::Filter;
use warp::http::Response;
use warp::hyper::Body;

use super::pieces::piece_size;
use super::{Answer, Asked, fetch};

const TRACK_BYTES: usize = 300_000;
const NODE_WAIT: Duration = Duration::from_secs(8);
const LONG: Duration = Duration::from_secs(20);
const SAY: &[u8] = b"event: say\ndata: {\"text\":\"one\"}\n\n";
const KEEPALIVE: &[u8] = b": keepalive\n\n";
const DONE: &[u8] = b"event: done\ndata: {}\n\n";

fn track() -> Vec<u8> {
    (0..TRACK_BYTES).map(|at| (at * 31 % 251) as u8).collect()
}

#[derive(Clone, Copy)]
struct Node {
    announces_length: bool,
    breaks_pieces_over: usize,
}

const HEALTHY: Node = Node {
    announces_length: true,
    breaks_pieces_over: usize::MAX,
};

fn piece(node: Node, asked: HashMap<String, String>) -> Response<Body> {
    let whole = track();
    let from: usize = asked["from"].parse().unwrap();
    let max: usize = asked["max"].parse().unwrap();
    let bytes = whole[from..(from + max).min(whole.len())].to_vec();
    let end = from + bytes.len() == whole.len();
    let body = if max > node.breaks_pieces_over {
        let torn = futures_util::stream::iter([
            Ok(bytes[..bytes.len() / 2].to_vec()),
            Err(std::io::Error::other("cut")),
        ]);
        Body::wrap_stream(torn)
    } else {
        Body::from(bytes)
    };
    Response::builder()
        .header("x-pro-end", if end { "1" } else { "0" })
        .header("x-pro-total", whole.len())
        .body(body)
        .unwrap()
}

fn serving(node: Node) -> String {
    let headers = if node.announces_length {
        format!(r#"[["content-length","{TRACK_BYTES}"]]"#)
    } else {
        "[]".to_string()
    };
    let open = warp::path("open").and(warp::post()).map(move || {
        let opened = format!(r#"{{"id":"answer","status":200,"headers":{headers}}}"#);
        Response::new(Body::from(opened))
    });
    let take = warp::path!("take" / String)
        .and(warp::get())
        .and(warp::query::<HashMap<String, String>>())
        .map(move |_id: String, asked| piece(node, asked));
    let closed = warp::path!("take" / String)
        .and(warp::delete())
        .map(|_id: String| Response::new(Body::empty()));
    let (addr, server) = warp::serve(open.or(take).or(closed)).bind_ephemeral(([127, 0, 0, 1], 0));
    tokio::spawn(server);
    format!("http://{addr}")
}

#[derive(Clone, Default)]
struct Written {
    bytes: Vec<u8>,
    ended: bool,
}

#[derive(Clone)]
struct Origin(Arc<watch::Sender<Written>>);

impl Origin {
    fn open() -> Origin {
        Origin(Arc::new(watch::channel(Written::default()).0))
    }

    fn write(&self, bytes: &[u8], ended: bool) {
        self.0.send_modify(|written| {
            written.bytes.extend_from_slice(bytes);
            written.ended = ended;
        });
    }

    async fn piece(self, asked: HashMap<String, String>) -> Response<Body> {
        let from: usize = asked["from"].parse().unwrap();
        let max: usize = asked["max"].parse().unwrap();
        let mut watched = self.0.subscribe();
        let arrived = watched.wait_for(|written| written.bytes.len() > from || written.ended);
        let written = match tokio::time::timeout(NODE_WAIT, arrived).await {
            Ok(Ok(written)) => written.clone(),
            _ => self.0.borrow().clone(),
        };
        let bytes = written.bytes[from..(from + max).min(written.bytes.len())].to_vec();
        let last = written.ended && from + bytes.len() == written.bytes.len();
        let mut answer = Response::builder().header("x-pro-end", if last { "1" } else { "0" });
        if written.ended {
            answer = answer.header("x-pro-total", written.bytes.len());
        }
        answer.body(Body::from(bytes)).unwrap()
    }
}

fn streaming(origin: Origin) -> String {
    let open = warp::path("open").and(warp::post()).map(|| {
        let headers = r#"[["content-type","text/event-stream"]]"#;
        let opened = format!(r#"{{"id":"answer","status":200,"headers":{headers}}}"#);
        Response::new(Body::from(opened))
    });
    let take = warp::path!("take" / String)
        .and(warp::get())
        .and(warp::query::<HashMap<String, String>>())
        .then(move |_id: String, asked| origin.clone().piece(asked));
    let closed = warp::path!("take" / String)
        .and(warp::delete())
        .map(|_id: String| Response::new(Body::empty()));
    let (addr, server) = warp::serve(open.or(take).or(closed)).bind_ephemeral(([127, 0, 0, 1], 0));
    tokio::spawn(server);
    format!("http://{addr}")
}

fn turn() -> Asked {
    Asked {
        method: "POST".to_string(),
        url: "https://api.scnative.dev/voice/chat".to_string(),
        headers: Vec::new(),
        body: Some(b"{}".to_vec()),
    }
}

async fn next(answer: &mut Answer) -> Option<Bytes> {
    let piece = tokio::time::timeout(LONG, answer.body.next()).await;
    piece.expect("a piece in time").map(|piece| piece.unwrap())
}

fn asked() -> Asked {
    Asked {
        method: "GET".to_string(),
        url: "https://storage.scnative.dev/track".to_string(),
        headers: Vec::new(),
        body: None,
    }
}

async fn collected(node: &str) -> Result<Vec<u8>, String> {
    let mut answer = fetch(node, asked()).await?;
    let mut body = Vec::new();
    while let Some(piece) = answer.body.next().await {
        body.extend_from_slice(&piece?);
    }
    Ok(body)
}

#[tokio::test(flavor = "multi_thread")]
async fn an_answer_of_known_length_is_put_back_together() {
    assert_eq!(collected(&serving(HEALTHY)).await.unwrap(), track());
}

#[tokio::test(flavor = "multi_thread")]
async fn an_answer_of_unknown_length_is_put_back_together() {
    let node = Node {
        announces_length: false,
        ..HEALTHY
    };
    assert_eq!(collected(&serving(node)).await.unwrap(), track());
}

#[tokio::test(flavor = "multi_thread")]
async fn pieces_get_smaller_until_they_pass_a_link_that_cuts_big_ones() {
    let node = Node {
        breaks_pieces_over: 4 * 1024,
        ..HEALTHY
    };
    assert_eq!(collected(&serving(node)).await.unwrap(), track());
    assert!(piece_size() <= 4 * 1024);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_node_that_refuses_to_open_is_an_error() {
    let refusing = warp::any()
        .map(|| Ok::<_, Infallible>(Response::builder().status(503).body(Body::empty()).unwrap()));
    let (addr, server) = warp::serve(refusing).bind_ephemeral(([127, 0, 0, 1], 0));
    tokio::spawn(server);
    assert!(fetch(&format!("http://{addr}"), asked()).await.is_err());
}

#[tokio::test(flavor = "multi_thread")]
async fn an_answer_still_being_written_comes_as_it_is_written() {
    let origin = Origin::open();
    let node = streaming(origin.clone());
    origin.write(SAY, false);
    let mut answer = fetch(&node, turn()).await.unwrap();
    assert_eq!(next(&mut answer).await.as_deref(), Some(SAY));
    origin.write(KEEPALIVE, false);
    assert_eq!(next(&mut answer).await.as_deref(), Some(KEEPALIVE));
    origin.write(DONE, true);
    assert_eq!(next(&mut answer).await.as_deref(), Some(DONE));
    assert_eq!(next(&mut answer).await, None);
}

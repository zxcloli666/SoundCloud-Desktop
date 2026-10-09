use std::collections::HashMap;
use std::convert::Infallible;

use futures_util::StreamExt;
use warp::Filter;
use warp::http::Response;
use warp::hyper::Body;

use super::pieces::piece_size;
use super::{Asked, fetch};

const TRACK_BYTES: usize = 300_000;

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

fn asked() -> Asked {
    Asked {
        method: "GET".to_string(),
        url: "https://storage.scnative.space/track".to_string(),
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

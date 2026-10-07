use std::convert::Infallible;
use std::error::Error as _;
use std::io;
use std::net::SocketAddr;
use std::sync::Arc;

use futures_util::stream;
use tokio::sync::watch;
use warp::http::{Response, StatusCode};
use warp::hyper::Body;
use warp::{Filter, Rejection, Reply};

use super::state::Shared;
use crate::network::image_cache;

const OVERLAY: &str = include_str!("overlay.html");

fn with<T: Clone + Send>(value: T) -> impl Filter<Extract = (T,), Error = Infallible> + Clone {
    warp::any().map(move || value.clone())
}

fn io_error(error: warp::Error) -> io::Error {
    let mut source = error.source();
    while let Some(inner) = source {
        if let Some(io) = inner.downcast_ref::<io::Error>() {
            return io::Error::new(io.kind(), io.to_string());
        }
        source = inner.source();
    }
    io::Error::other(error.to_string())
}

fn plain(status: StatusCode, content_type: &str, body: impl Into<Body>) -> Response<Body> {
    Response::builder()
        .status(status)
        .header("Content-Type", content_type)
        .header("Cache-Control", "no-store")
        .body(body.into())
        .unwrap_or_default()
}

async fn cover(shared: Arc<Shared>) -> Result<Response<Body>, Rejection> {
    let (key, source) = {
        let snapshot = shared.snapshot.borrow();
        (
            snapshot.np.cover_key.clone(),
            snapshot.np.artwork_url.clone(),
        )
    };
    if let Some(key) = key {
        let image = image_cache::handle(&key).await;
        if image.status == 200 {
            return Ok(Response::builder()
                .header("Content-Type", image.content_type)
                .header("Cache-Control", "public, max-age=86400")
                .body(Body::from(image.data))
                .unwrap_or_default());
        }
    }
    Ok(match source {
        Some(url) => Response::builder()
            .status(StatusCode::FOUND)
            .header("Location", url)
            .body(Body::empty())
            .unwrap_or_default(),
        None => plain(StatusCode::NOT_FOUND, "text/plain", ""),
    })
}

fn events(shared: Arc<Shared>, alive: watch::Receiver<()>, origin: Arc<str>) -> impl Reply {
    let updates = stream::unfold(
        (shared.snapshot.subscribe(), alive, true),
        move |(mut rx, mut alive, first)| {
            let origin = origin.clone();
            async move {
                if !first {
                    tokio::select! {
                        changed = rx.changed() => changed.ok()?,
                        _ = alive.changed() => return None,
                    }
                }
                let data = serde_json::to_string(&rx.borrow_and_update().view(&origin)).ok()?;
                let event = warp::sse::Event::default().data(data);
                Some((Ok::<_, Infallible>(event), (rx, alive, false)))
            }
        },
    );
    warp::sse::reply(warp::sse::keep_alive().stream(updates))
}

pub fn start(shared: Arc<Shared>, port: u16) -> io::Result<watch::Sender<()>> {
    let (alive, alive_rx) = watch::channel(());
    let origin: Arc<str> = format!("http://127.0.0.1:{port}").into();

    let overlay = warp::path::end()
        .or(warp::path!("overlay"))
        .unify()
        .map(|| plain(StatusCode::OK, "text/html; charset=utf-8", OVERLAY));

    let json = warp::path!("np.json")
        .and(with(shared.clone()))
        .and(with(origin.clone()))
        .map(|shared: Arc<Shared>, origin: Arc<str>| {
            let body =
                serde_json::to_string(&shared.snapshot.borrow().view(&origin)).unwrap_or_default();
            plain(StatusCode::OK, "application/json", body)
        });

    let text = warp::path!("np.txt")
        .and(with(shared.clone()))
        .map(|shared: Arc<Shared>| {
            let body = shared.render(&shared.snapshot.borrow().np);
            plain(StatusCode::OK, "text/plain; charset=utf-8", body)
        });

    let artwork = warp::path!("cover")
        .and(with(shared.clone()))
        .and_then(cover);

    let stream = warp::path!("events")
        .and(with(shared))
        .and(with(alive_rx.clone()))
        .and(with(origin))
        .map(events);

    let routes = warp::get()
        .and(overlay.or(json).or(text).or(artwork).or(stream))
        .with(warp::cors().allow_any_origin().allow_method("GET"));

    let mut stop = alive_rx;
    let addr: SocketAddr = ([127, 0, 0, 1], port).into();
    let (_, server) = warp::serve(routes)
        .try_bind_with_graceful_shutdown(addr, async move { while stop.changed().await.is_ok() {} })
        .map_err(io_error)?;
    tokio::spawn(server);
    Ok(alive)
}

use std::net::SocketAddr;

use warp::hyper::Body;
use warp::Filter;

use crate::network::image_cache;
use crate::network::proxy::{cache_control_for, proxy_request};
use crate::network::server::cors;

pub async fn start() -> u16 {
    let proxy_route =
        warp::path("p")
            .and(warp::path::tail())
            .and_then(|tail: warp::path::Tail| async move {
                let encoded_url = tail.as_str();
                let result = proxy_request(encoded_url).await;
                Ok::<_, warp::Rejection>(
                    warp::http::Response::builder()
                        .status(result.status)
                        .header("Content-Type", &result.content_type)
                        .header("Cache-Control", cache_control_for(result.status))
                        .body(Body::from(result.data))
                        .unwrap(),
                )
            });

    let image_route =
        warp::path("img")
            .and(warp::path::tail())
            .and_then(|tail: warp::path::Tail| async move {
                let encoded = tail.as_str();
                let result = image_cache::handle(encoded).await;
                Ok::<_, warp::Rejection>(
                    warp::http::Response::builder()
                        .status(result.status)
                        .header("Content-Type", &result.content_type)
                        .header("Cache-Control", cache_control_for(result.status))
                        .body(Body::from(result.data))
                        .unwrap(),
                )
            });

    let routes = image_route.or(proxy_route).with(cors());

    let addr: SocketAddr = ([127, 0, 0, 1], 0).into();
    let (addr, server) = warp::serve(routes).bind_ephemeral(addr);
    tokio::spawn(server);

    println!("[ProxyServer] http://127.0.0.1:{}", addr.port());
    addr.port()
}

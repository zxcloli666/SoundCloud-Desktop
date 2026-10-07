use std::net::SocketAddr;
use std::path::PathBuf;

use tokio::fs::File;
use tokio::io::AsyncReadExt;
use warp::http::{Response, StatusCode};
use warp::hyper::Body;
use warp::Filter;

use crate::app::diagnostics;
use crate::network::server::cors;

fn content_type_for(filename: &str) -> &'static str {
    if filename.ends_with(".png") {
        "image/png"
    } else if filename.ends_with(".webp") {
        "image/webp"
    } else if filename.ends_with(".gif") {
        "image/gif"
    } else if filename.ends_with(".svg") {
        "image/svg+xml"
    } else if filename.ends_with(".jpg") || filename.ends_with(".jpeg") {
        "image/jpeg"
    } else {
        "application/octet-stream"
    }
}

pub async fn start(wallpapers_dir: PathBuf) -> u16 {
    let wallpapers = wallpapers_dir.clone();

    let wallpaper_route = warp::path("wallpapers")
        .and(warp::path::param::<String>())
        .and(warp::path::end())
        .and_then(move |filename: String| {
            let dir = wallpapers.clone();
            async move {
                if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
                    return Ok::<_, warp::Rejection>(
                        Response::builder()
                            .status(StatusCode::BAD_REQUEST)
                            .body(Body::empty())
                            .unwrap(),
                    );
                }

                let path = dir.join(&filename);
                let mut file = match File::open(&path).await {
                    Ok(f) => f,
                    Err(_) => {
                        return Ok(Response::builder()
                            .status(StatusCode::NOT_FOUND)
                            .body(Body::empty())
                            .unwrap());
                    }
                };

                let metadata = file.metadata().await.unwrap();
                let total = metadata.len();
                let ct = content_type_for(&filename);

                let mut buf = Vec::with_capacity(total as usize);
                file.read_to_end(&mut buf).await.unwrap_or_default();

                Ok(Response::builder()
                    .status(StatusCode::OK)
                    .header("Content-Type", ct)
                    .header("Content-Length", total.to_string())
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Body::from(buf))
                    .unwrap())
            }
        });

    let routes = wallpaper_route.with(cors());

    let addr: SocketAddr = ([127, 0, 0, 1], 0).into();
    let (addr, server) = warp::serve(routes).bind_ephemeral(addr);
    tokio::spawn(server);

    diagnostics::log("INFO", format!("[StaticServer] http://127.0.0.1:{}", addr.port()));
    addr.port()
}

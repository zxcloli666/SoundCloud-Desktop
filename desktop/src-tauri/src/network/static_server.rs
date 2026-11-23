use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use tokio::fs::File;
use tokio::io::AsyncReadExt;
use warp::http::{Response, StatusCode};
use warp::hyper::Body;
use warp::Filter;

use crate::app::{diagnostics, themes};
use crate::network::server::cors;
use crate::video_cache::VideoCache;

fn content_type_for(filename: &str) -> &'static str {
    if filename.ends_with(".png") {
        "image/png"
    } else if filename.ends_with(".webp") {
        "image/webp"
    } else if filename.ends_with(".gif") {
        "image/gif"
    } else if filename.ends_with(".avif") {
        "image/avif"
    } else if filename.ends_with(".svg") {
        "image/svg+xml"
    } else if filename.ends_with(".heic") {
        "image/heic"
    } else if filename.ends_with(".jxl") {
        "image/jxl"
    } else if filename.ends_with(".bmp") {
        "image/bmp"
    } else if filename.ends_with(".tif") || filename.ends_with(".tiff") {
        "image/tiff"
    } else if filename.ends_with(".jpg")
        || filename.ends_with(".jpeg")
        || filename.ends_with(".jfif")
    {
        "image/jpeg"
    } else if filename.ends_with(".woff2") {
        "font/woff2"
    } else {
        "application/octet-stream"
    }
}

const SANDBOX_CSP: &str = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox";

fn any_name(_: &str) -> bool {
    true
}

fn dir_route(
    prefix: &'static str,
    dir: PathBuf,
    accept: fn(&str) -> bool,
) -> impl Filter<Extract = (Response<Body>,), Error = warp::Rejection> + Clone {
    warp::path(prefix)
        .and(warp::path::param::<String>())
        .and(warp::path::end())
        .and_then(move |filename: String| {
            let dir = dir.clone();
            async move {
                if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
                    return Ok::<_, warp::Rejection>(
                        Response::builder()
                            .status(StatusCode::BAD_REQUEST)
                            .body(Body::empty())
                            .unwrap(),
                    );
                }
                if !accept(&filename) {
                    return Ok(Response::builder()
                        .status(StatusCode::NOT_FOUND)
                        .body(Body::empty())
                        .unwrap());
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
                    .header("Content-Security-Policy", SANDBOX_CSP)
                    .header("X-Content-Type-Options", "nosniff")
                    .body(Body::from(buf))
                    .unwrap())
            }
        })
}

pub async fn start(
    wallpapers_dir: PathBuf,
    local_covers_dir: PathBuf,
    css_assets_dir: PathBuf,
    theme_files_dir: PathBuf,
    video: Arc<VideoCache>,
) -> u16 {
    let routes = dir_route("wallpapers", wallpapers_dir, any_name)
        .or(dir_route("local-covers", local_covers_dir, any_name))
        .unify()
        .or(dir_route("css-assets", css_assets_dir, any_name))
        .unify()
        .or(dir_route(
            "theme-files",
            theme_files_dir,
            themes::is_served_name,
        ))
        .unify()
        .or(crate::video_cache::server::route(video))
        .unify()
        .with(cors());

    let addr: SocketAddr = ([127, 0, 0, 1], 0).into();
    let (addr, server) = warp::serve(routes).bind_ephemeral(addr);
    tokio::spawn(server);

    diagnostics::log("INFO", format!("[StaticServer] http://127.0.0.1:{}", addr.port()));
    addr.port()
}

use std::io::SeekFrom;
use std::path::PathBuf;

use bytes::Bytes;
use futures_util::stream;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use warp::Filter;
use warp::http::{Response, StatusCode};
use warp::hyper::Body;

use super::byte_range::{self, Span};
use crate::shared::file_lru::mark_used;

const CHUNK: usize = 256 * 1024;

pub fn is_file_name(name: &str) -> bool {
    name.strip_suffix(".mp4")
        .is_some_and(|hash| hash.len() == 64 && hash.bytes().all(|b| b.is_ascii_hexdigit()))
}

pub fn route(
    dir: PathBuf,
) -> impl Filter<Extract = (Response<Body>,), Error = warp::Rejection> + Clone {
    warp::path("video")
        .and(warp::path::param::<String>())
        .and(warp::path::end())
        .and(warp::get())
        .and(warp::header::optional::<String>("range"))
        .and_then(move |name: String, range: Option<String>| {
            let dir = dir.clone();
            async move { Ok::<_, warp::Rejection>(serve(dir, name, range).await) }
        })
}

async fn serve(dir: PathBuf, name: String, range: Option<String>) -> Response<Body> {
    if !is_file_name(&name) {
        return status(StatusCode::NOT_FOUND);
    }
    let path = dir.join(&name);
    let Ok(mut file) = File::open(&path).await else {
        return status(StatusCode::NOT_FOUND);
    };
    let Ok(len) = file.metadata().await.map(|meta| meta.len()) else {
        return status(StatusCode::NOT_FOUND);
    };
    mark_used(&path);
    let (start, end, code) = match byte_range::parse(range.as_deref(), len) {
        Span::Whole => (0, len.saturating_sub(1), StatusCode::OK),
        Span::Part { start, end } => (start, end, StatusCode::PARTIAL_CONTENT),
        Span::Unsatisfiable => {
            return Response::builder()
                .status(StatusCode::RANGE_NOT_SATISFIABLE)
                .header("Content-Range", format!("bytes */{len}"))
                .body(Body::empty())
                .unwrap();
        }
    };
    if file.seek(SeekFrom::Start(start)).await.is_err() {
        return status(StatusCode::INTERNAL_SERVER_ERROR);
    }
    let count = if len == 0 { 0 } else { end - start + 1 };
    let mut response = Response::builder()
        .status(code)
        .header("Content-Type", "video/mp4")
        .header("Content-Length", count.to_string())
        .header("Accept-Ranges", "bytes")
        .header("Cache-Control", "no-store")
        .header("X-Content-Type-Options", "nosniff");
    if code == StatusCode::PARTIAL_CONTENT {
        response = response.header("Content-Range", format!("bytes {start}-{end}/{len}"));
    }
    response.body(Body::wrap_stream(chunks(file, count))).unwrap()
}

fn chunks(
    file: File,
    count: u64,
) -> impl futures_util::Stream<Item = Result<Bytes, std::io::Error>> + Send {
    stream::try_unfold((file, count), |(mut file, left)| async move {
        if left == 0 {
            return Ok(None);
        }
        let mut buf = vec![0u8; CHUNK.min(left as usize)];
        let read = file.read(&mut buf).await?;
        if read == 0 {
            return Ok(None);
        }
        buf.truncate(read);
        Ok(Some((Bytes::from(buf), (file, left - read as u64))))
    })
}

fn status(code: StatusCode) -> Response<Body> {
    Response::builder().status(code).body(Body::empty()).unwrap()
}

#[cfg(test)]
mod tests {
    use super::{is_file_name, route};

    fn temp_dir() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("video-server-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn only_hex_mp4_names_are_served() {
        assert!(is_file_name(&format!("{}.mp4", "a1".repeat(32))));
        assert!(!is_file_name("../x.mp4"));
        assert!(!is_file_name(&format!("{}.part", "a".repeat(64))));
    }

    #[tokio::test]
    async fn a_range_is_answered_with_206_and_the_slice() {
        let dir = temp_dir();
        let name = format!("{}.mp4", "b".repeat(64));
        std::fs::write(dir.join(&name), (0u8..100).collect::<Vec<_>>()).unwrap();

        let filter = route(dir.clone());
        let reply = warp::test::request()
            .path(&format!("/video/{name}"))
            .header("range", "bytes=10-19")
            .reply(&filter)
            .await;
        assert_eq!(reply.status(), 206);
        assert_eq!(reply.headers()["content-range"], "bytes 10-19/100");
        assert_eq!(reply.body().as_ref(), (10u8..20).collect::<Vec<_>>().as_slice());

        let whole = warp::test::request()
            .path(&format!("/video/{name}"))
            .reply(&filter)
            .await;
        assert_eq!(whole.status(), 200);
        assert_eq!(whole.body().len(), 100);

        let past = warp::test::request()
            .path(&format!("/video/{name}"))
            .header("range", "bytes=200-")
            .reply(&filter)
            .await;
        assert_eq!(past.status(), 416);
        assert_eq!(past.headers()["content-range"], "bytes */100");

        let foreign = warp::test::request()
            .path("/video/..%2Fsecret.mp4")
            .reply(&filter)
            .await;
        assert_eq!(foreign.status(), 404);
        std::fs::remove_dir_all(&dir).ok();
    }
}

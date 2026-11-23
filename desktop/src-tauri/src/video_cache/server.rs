use std::io::SeekFrom;
use std::path::Path;
use std::sync::Arc;

use bytes::Bytes;
use futures_util::stream;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use warp::Filter;
use warp::http::{Response, StatusCode};
use warp::hyper::Body;

use super::VideoCache;
use super::reel::Reel;
use crate::network::byte_range::{self, Span};
use crate::shared::file_lru::mark_used;

const CHUNK: usize = 256 * 1024;

pub fn is_file_name(name: &str) -> bool {
    name.strip_suffix(".mp4")
        .is_some_and(|hash| hash.len() == 64 && hash.bytes().all(|b| b.is_ascii_hexdigit()))
}

pub fn route(
    cache: Arc<VideoCache>,
) -> impl Filter<Extract = (Response<Body>,), Error = warp::Rejection> + Clone {
    warp::path("video")
        .and(warp::path::param::<String>())
        .and(warp::path::end())
        .and(warp::get())
        .and(warp::header::optional::<String>("range"))
        .and_then(move |name: String, range: Option<String>| {
            let cache = cache.clone();
            async move { Ok::<_, warp::Rejection>(serve(cache, name, range).await) }
        })
}

struct Open {
    file: File,
    len: u64,
    reel: Option<Arc<Reel>>,
}

async fn serve(cache: Arc<VideoCache>, name: String, range: Option<String>) -> Response<Body> {
    if !is_file_name(&name) {
        return status(StatusCode::NOT_FOUND);
    }
    let Some(Open {
        mut file,
        len,
        reel,
    }) = open(&cache, &name).await
    else {
        return status(StatusCode::NOT_FOUND);
    };
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
    let body = Reading {
        cache,
        reel,
        file,
        at: start,
        end: start + count,
    };
    response.body(Body::wrap_stream(body.chunks())).unwrap()
}

async fn open(cache: &VideoCache, name: &str) -> Option<Open> {
    let path = cache.dir().join(name);
    if let Some(open) = open_whole(&path).await {
        return Some(open);
    }
    let reel = cache.reel(name)?;
    match File::open(reel.part()).await {
        Ok(file) => Some(Open {
            file,
            len: reel.total()?,
            reel: Some(reel),
        }),
        Err(_) => open_whole(&path).await,
    }
}

async fn open_whole(path: &Path) -> Option<Open> {
    let file = File::open(path).await.ok()?;
    let len = file.metadata().await.ok()?.len();
    mark_used(path);
    Some(Open {
        file,
        len,
        reel: None,
    })
}

struct Reading {
    cache: Arc<VideoCache>,
    reel: Option<Arc<Reel>>,
    file: File,
    at: u64,
    end: u64,
}

impl Reading {
    fn chunks(self) -> impl futures_util::Stream<Item = Result<Bytes, std::io::Error>> + Send {
        stream::try_unfold(self, |mut reading| async move {
            if reading.at == reading.end {
                return Ok(None);
            }
            let until = reading.until().await?;
            let most = CHUNK.min((until - reading.at) as usize);
            let mut buf = vec![0u8; most];
            let read = reading.file.read(&mut buf).await?;
            if read == 0 {
                return Ok(None);
            }
            buf.truncate(read);
            reading.at += read as u64;
            Ok(Some((Bytes::from(buf), reading)))
        })
    }

    async fn until(&self) -> std::io::Result<u64> {
        let Some(reel) = &self.reel else {
            return Ok(self.end);
        };
        let ready = self.cache.ready(reel, self.at).await;
        ready
            .map(|end| end.min(self.end))
            .map_err(std::io::Error::other)
    }
}

fn status(code: StatusCode) -> Response<Body> {
    Response::builder()
        .status(code)
        .body(Body::empty())
        .unwrap()
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use std::sync::Arc;

    use super::{is_file_name, route};
    use crate::video_cache::VideoCache;

    fn cache(test: &str) -> (PathBuf, Arc<VideoCache>) {
        let dir = std::env::temp_dir().join(format!("video-server-{test}-{}", std::process::id()));
        std::fs::remove_dir_all(&dir).ok();
        (dir.clone(), VideoCache::init(dir))
    }

    #[test]
    fn only_hex_mp4_names_are_served() {
        assert!(is_file_name(&format!("{}.mp4", "a1".repeat(32))));
        assert!(!is_file_name("../x.mp4"));
        assert!(!is_file_name(&format!("{}.part", "a".repeat(64))));
    }

    #[tokio::test]
    async fn a_range_is_answered_with_206_and_the_slice() {
        let (dir, cache) = cache("range");
        let name = format!("{}.mp4", "b".repeat(64));
        std::fs::write(dir.join(&name), (0u8..100).collect::<Vec<_>>()).unwrap();

        let filter = route(cache);
        let reply = warp::test::request()
            .path(&format!("/video/{name}"))
            .header("range", "bytes=10-19")
            .reply(&filter)
            .await;
        assert_eq!(reply.status(), 206);
        assert_eq!(reply.headers()["content-range"], "bytes 10-19/100");
        assert_eq!(
            reply.body().as_ref(),
            (10u8..20).collect::<Vec<_>>().as_slice()
        );

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

    #[tokio::test]
    async fn a_video_still_loading_is_served_as_its_bytes_land() {
        let (dir, cache) = cache("loading");
        let (name, reel) = cache
            .reel_of("https://storage.scnative.dev/video/1-1.mp4")
            .unwrap();
        let reel = reel.unwrap();
        reel.learn(100).unwrap();
        let bytes = (0u8..100).collect::<Vec<_>>();
        std::fs::write(reel.part(), &bytes[..60]).unwrap();
        reel.landed(40..60);

        let filter = route(cache.clone());
        let asked = tokio::spawn(async move {
            warp::test::request()
                .path(&format!("/video/{name}"))
                .header("range", "bytes=50-79")
                .reply(&filter)
                .await
        });
        while !reel.asks_elsewhere(1_000_000) {
            tokio::task::yield_now().await;
        }
        assert!(!asked.is_finished());
        std::fs::write(reel.part(), &bytes).unwrap();
        reel.landed(60..100);

        let reply = asked.await.unwrap();
        assert_eq!(reply.status(), 206);
        assert_eq!(reply.headers()["content-range"], "bytes 50-79/100");
        assert_eq!(reply.body().as_ref(), &bytes[50..80]);
        std::fs::remove_dir_all(&dir).ok();
    }
}

use std::io::Read;
use std::time::Duration;

use bytes::Bytes;
use futures_util::StreamExt;
use tokio::runtime::Handle;
use tokio::sync::mpsc;
use voice_models::{Fetch, FetchError, Response};
use wreq::Method;
use wreq::header::{CONTENT_LENGTH, CONTENT_RANGE, RANGE};

use crate::network::edge;
use crate::network::netcheck::model::Role;
use crate::network::{fetch, traced};

const STALL: Duration = Duration::from_secs(20);
const CHUNKS: usize = 16;

pub struct ModelFetch {
    pub rt: Handle,
}

impl Fetch for ModelFetch {
    fn get(&self, url: &str, offset: u64) -> Result<Response, FetchError> {
        self.rt.block_on(open(url, offset))
    }
}

async fn open(url: &str, offset: u64) -> Result<Response, FetchError> {
    let client =
        fetch::client().ok_or_else(|| FetchError::Network("http client is unavailable".into()))?;
    let mut last = FetchError::Network("no route".into());
    for (at, hop) in edge::audio_plan(url).iter().enumerate() {
        let (mut request, flight) =
            traced::begin(client, Method::GET, hop, Role::of_index(at), "voice");
        if offset > 0 {
            request = request.header(RANGE, format!("bytes={offset}-"));
        }
        let response = match request.send().await {
            Ok(response) => response,
            Err(error) => {
                flight.broke(&error);
                hop.note(false);
                last = FetchError::Network(format!("{}: {error}", hop.tier_label()));
                continue;
            }
        };
        let status = response.status().as_u16();
        flight.answered(status, 0);
        if !edge::hop_ok(hop, &response) {
            last = FetchError::Status(status);
            continue;
        }
        hop.note(true);
        if status != 200 && status != 206 {
            return Err(FetchError::Status(status));
        }
        let (start, total) = span(&response, status);
        return Ok(Response {
            start,
            total,
            body: Box::new(Body::pump(response)),
        });
    }
    Err(last)
}

fn header(response: &wreq::Response, name: wreq::header::HeaderName) -> Option<String> {
    response
        .headers()
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string)
}

fn span(response: &wreq::Response, status: u16) -> (u64, u64) {
    if status == 206
        && let Some(range) = header(response, CONTENT_RANGE)
    {
        return content_range(&range).unwrap_or((0, 0));
    }
    let length = header(response, CONTENT_LENGTH)
        .and_then(|v| v.trim().parse().ok())
        .unwrap_or(0);
    (0, length)
}

fn content_range(value: &str) -> Option<(u64, u64)> {
    let rest = value.trim().strip_prefix("bytes")?.trim();
    let (range, total) = rest.split_once('/')?;
    let (start, _) = range.split_once('-')?;
    Some((start.trim().parse().ok()?, total.trim().parse().ok()?))
}

struct Body {
    chunks: mpsc::Receiver<Result<Bytes, String>>,
    chunk: Bytes,
}

impl Body {
    fn pump(response: wreq::Response) -> Body {
        let (tx, chunks) = mpsc::channel(CHUNKS);
        tokio::spawn(async move {
            let mut stream = response.bytes_stream();
            loop {
                let next = match tokio::time::timeout(STALL, stream.next()).await {
                    Ok(Some(Ok(bytes))) => Ok(bytes),
                    Ok(Some(Err(error))) => Err(error.to_string()),
                    Ok(None) => return,
                    Err(_) => Err("download stalled".to_string()),
                };
                let failed = next.is_err();
                if tx.send(next).await.is_err() || failed {
                    return;
                }
            }
        });
        Body {
            chunks,
            chunk: Bytes::new(),
        }
    }
}

impl Read for Body {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        while self.chunk.is_empty() {
            match self.chunks.blocking_recv() {
                Some(Ok(bytes)) => self.chunk = bytes,
                Some(Err(error)) => return Err(std::io::Error::other(error)),
                None => return Ok(0),
            }
        }
        let n = buf.len().min(self.chunk.len());
        buf[..n].copy_from_slice(&self.chunk[..n]);
        self.chunk = self.chunk.slice(n..);
        Ok(n)
    }
}

#[cfg(test)]
mod tests {
    use std::io::Read;

    use voice_models::Fetch;
    use warp::Filter;

    use super::{ModelFetch, content_range};

    fn body() -> Vec<u8> {
        (0..300_000u32).map(|i| (i % 251) as u8).collect()
    }

    fn serve(rt: &tokio::runtime::Runtime) -> String {
        let route = warp::path("model.bin")
            .and(warp::header::optional::<String>("range"))
            .map(|range: Option<String>| {
                let all = body();
                let start = range
                    .and_then(|r| {
                        r.strip_prefix("bytes=")?
                            .strip_suffix('-')?
                            .parse::<usize>()
                            .ok()
                    })
                    .unwrap_or(0);
                let total = all.len();
                let mut reply = warp::http::Response::builder();
                if start > 0 {
                    reply = reply.status(206).header(
                        "content-range",
                        format!("bytes {start}-{}/{total}", total - 1),
                    );
                }
                reply
                    .header("content-length", total - start)
                    .body(all[start..].to_vec())
                    .unwrap()
            });
        let _guard = rt.enter();
        let (addr, server) = warp::serve(route).bind_ephemeral(([127, 0, 0, 1], 0));
        rt.spawn(server);
        format!("http://{addr}/model.bin")
    }

    #[test]
    fn content_range_gives_start_and_total() {
        assert_eq!(content_range("bytes 100-199/1000"), Some((100, 1000)));
        assert_eq!(content_range("bytes 0-0/1"), Some((0, 1)));
        assert_eq!(content_range("bytes */1000"), None);
    }

    #[test]
    fn a_model_file_streams_whole_and_from_an_offset() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let url = serve(&rt);
        let fetch = ModelFetch {
            rt: rt.handle().clone(),
        };

        let mut whole = fetch.get(&url, 0).unwrap();
        assert_eq!((whole.start, whole.total), (0, 300_000));
        let mut bytes = Vec::new();
        whole.body.read_to_end(&mut bytes).unwrap();
        assert_eq!(bytes, body());

        let mut rest = fetch.get(&url, 120_000).unwrap();
        assert_eq!((rest.start, rest.total), (120_000, 300_000));
        let mut bytes = Vec::new();
        rest.body.read_to_end(&mut bytes).unwrap();
        assert_eq!(bytes, body()[120_000..]);
    }

    #[test]
    fn a_missing_file_is_a_status_error() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let url = serve(&rt).replace("model.bin", "nothing.bin");
        let fetch = ModelFetch {
            rt: rt.handle().clone(),
        };
        let error = fetch.get(&url, 0).err().unwrap();
        assert!(
            matches!(error, voice_models::FetchError::Status(404)),
            "{error}"
        );
    }
}

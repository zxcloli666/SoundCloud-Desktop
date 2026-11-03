use std::sync::atomic::Ordering;

use futures_util::StreamExt;
use futures_util::stream;

use crate::rt::AppHandle;
use crate::shared::urn::canonical_track_urn;

use super::events::{Chunk, Progress, Row};
use super::failure::{Failure, SEARCH_UNAVAILABLE, SESSION_EXPIRED};
use super::hop::{HopError, post_json};
use super::model::{Cancel, ExtList, ExtTrack};

const CHUNK_SIZE: usize = 100;
const IN_FLIGHT: usize = 2;
const RETRIES: u32 = 5;
const MAX_FAILED_CHUNKS_IN_ROW: usize = 3;

#[derive(serde::Serialize)]
struct Item<'a> {
    artist: &'a str,
    title: &'a str,
    duration_ms: Option<u64>,
}

#[derive(serde::Serialize)]
struct Body<'a> {
    items: Vec<Item<'a>>,
}

#[derive(serde::Deserialize)]
struct Reply {
    results: Vec<Slot>,
}

#[derive(serde::Deserialize)]
struct Slot {
    urn: Option<String>,
}

pub async fn match_list(
    app: &AppHandle,
    client: &wreq::Client,
    backend_url: &str,
    session_id: &str,
    list: &ExtList,
    cancel: &Cancel,
    progress: &mut Progress,
) -> Result<(), Failure> {
    let url = format!("{backend_url}/tracks/match");
    let url = url.as_str();
    let tracks = list.tracks.as_slice();
    let mut replies = stream::iter(0..tracks.len().div_ceil(CHUNK_SIZE))
        .map(|index| async move {
            let start = index * CHUNK_SIZE;
            let chunk = &tracks[start..tracks.len().min(start + CHUNK_SIZE)];
            let result = match_chunk(client, url, session_id, chunk, cancel).await;
            (index, chunk, result)
        })
        .buffered(IN_FLIGHT);

    let mut failed_in_row = 0;
    while let Some((index, chunk, result)) = replies.next().await {
        if cancel.load(Ordering::Relaxed) {
            break;
        }
        progress.current += chunk.len();
        let done = match result {
            Ok(urns) => {
                failed_in_row = 0;
                record(progress, index * CHUNK_SIZE, chunk, urns)
            }
            Err(error) if error.is_unauthorized() => return Err(unauthorized(app, progress)),
            Err(error) => {
                failed_in_row += 1;
                progress.errors += chunk.len();
                if failed_in_row >= MAX_FAILED_CHUNKS_IN_ROW {
                    progress.emit(app);
                    return Err(Failure::new(SEARCH_UNAVAILABLE, error.reason));
                }
                rows_of(index * CHUNK_SIZE, chunk, vec![None; chunk.len()])
            }
        };
        done.emit(app);
        progress.emit(app);
    }
    Ok(())
}

fn unauthorized(app: &AppHandle, progress: &Progress) -> Failure {
    progress.emit(app);
    Failure::new(SESSION_EXPIRED, "match rejected the session (HTTP 401)")
}

fn rows_of(offset: usize, chunk: &[ExtTrack], urns: Vec<Option<String>>) -> Chunk {
    let rows = chunk
        .iter()
        .zip(urns)
        .enumerate()
        .map(|(index, (track, urn))| Row {
            position: offset + index,
            artist: track.artist.clone(),
            title: track.title.clone(),
            urn,
        })
        .collect();
    Chunk { rows }
}

fn record(
    progress: &mut Progress,
    offset: usize,
    chunk: &[ExtTrack],
    urns: Vec<Option<String>>,
) -> Chunk {
    let found = urns.iter().flatten().count();
    progress.found += found;
    progress.not_found += chunk.len() - found;
    rows_of(offset, chunk, urns)
}

async fn match_chunk(
    client: &wreq::Client,
    url: &str,
    session_id: &str,
    chunk: &[ExtTrack],
    cancel: &Cancel,
) -> Result<Vec<Option<String>>, HopError> {
    let body = Body {
        items: chunk
            .iter()
            .map(|track| Item {
                artist: &track.artist,
                title: &track.title,
                duration_ms: track.duration_ms,
            })
            .collect(),
    };

    let mut retries = 0;
    loop {
        let reply: Result<Reply, HopError> =
            post_json(client, url, session_id, &body, cancel).await;
        match reply {
            Ok(reply) if reply.results.len() == chunk.len() => {
                let urns = reply
                    .results
                    .into_iter()
                    .map(|slot| slot.urn.as_deref().and_then(canonical_track_urn))
                    .collect();
                return Ok(urns);
            }
            Ok(reply) => {
                let reason = format!("{} results for {} items", reply.results.len(), chunk.len());
                return Err(HopError::transport(reason));
            }
            Err(error) if cancel.load(Ordering::Relaxed) => return Err(error),
            Err(error) if error.is_retryable() && retries < RETRIES => {
                retries += 1;
                tokio::time::sleep(error.pause(retries)).await;
            }
            Err(error) => return Err(error),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::AtomicBool;

    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    use super::{ExtTrack, match_chunk};

    async fn serve(replies: Vec<String>) -> (String, tokio::task::JoinHandle<Vec<String>>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/tracks/match", listener.local_addr().unwrap());
        let task = tokio::spawn(async move {
            let mut bodies = Vec::new();
            for reply in replies {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut buf = vec![0u8; 8192];
                let read = socket.read(&mut buf).await.unwrap();
                bodies.push(String::from_utf8_lossy(&buf[..read]).into_owned());
                socket.write_all(reply.as_bytes()).await.unwrap();
            }
            bodies
        });
        (url, task)
    }

    fn http(status: &str, extra: &str, body: &str) -> String {
        format!(
            "HTTP/1.1 {status}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n{extra}\r\n{body}",
            body.len()
        )
    }

    #[tokio::test]
    async fn retries_a_503_and_keeps_the_order_of_results() {
        let (url, server) = serve(vec![
            http("503 Service Unavailable", "retry-after: 0\r\n", "{}"),
            http(
                "200 OK",
                "",
                r#"{"results":[{"urn":"soundcloud:tracks:7"},{"urn":null}]}"#,
            ),
        ])
        .await;
        let chunk = vec![
            ExtTrack {
                artist: "A".into(),
                title: "One".into(),
                duration_ms: Some(1000),
            },
            ExtTrack {
                artist: "B".into(),
                title: "Two".into(),
                duration_ms: None,
            },
        ];
        let client = wreq::Client::new();
        let cancel = AtomicBool::new(false);

        let urns = match_chunk(&client, &url, "session", &chunk, &cancel)
            .await
            .ok()
            .unwrap();

        assert_eq!(urns, vec![Some("soundcloud:tracks:7".to_string()), None]);
        let bodies = server.await.unwrap();
        assert_eq!(bodies.len(), 2);
        assert!(bodies[1].to_lowercase().contains("x-session-id: session"));
        assert!(bodies[1].contains(r#"{"items":[{"artist":"A","title":"One","duration_ms":1000},{"artist":"B","title":"Two","duration_ms":null}]}"#));
    }
}

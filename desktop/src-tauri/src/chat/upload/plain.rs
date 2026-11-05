use std::sync::OnceLock;
use std::time::Duration;

use bytes::Bytes;
use futures_util::Stream;
use futures_util::stream;
use sc_chat::api::wire::PresignedPut;
use tokio::sync::watch;
use wreq::header::CONTENT_LENGTH;
use wreq::redirect::Policy;

use super::put::UNIT;
use crate::network::pace::Pace;
use crate::network::pro::Staging;
use crate::network::{fetch, system_proxy};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const PUT_TIMEOUT: Duration = Duration::from_secs(300);
const QUIET: Duration = Duration::from_secs(20);
const ANSWER_WAIT: Duration = Duration::from_secs(45);

pub(super) async fn plain(
    url: &str,
    target: &PresignedPut,
    body: Bytes,
    progress: watch::Sender<Staging>,
) -> Result<u16, String> {
    let client = client().ok_or("chat upload: http client is unavailable")?;
    let watched = progress.subscribe();
    let total = body.len() as u64;
    let mut request = client
        .put(url)
        .timeout(PUT_TIMEOUT)
        .header(CONTENT_LENGTH, body.len());
    for (name, value) in &target.headers {
        if !name.eq_ignore_ascii_case(CONTENT_LENGTH.as_str()) {
            request = request.header(name.as_str(), value.as_str());
        }
    }
    let sent = request
        .body(wreq::Body::wrap_stream(handed(body, progress)))
        .send();
    tokio::select! {
        sent = sent => sent
            .map(|response| response.status().as_u16())
            .map_err(|error| error.without_uri().to_string()),
        () = quiet(watched, total) => Err("chat upload: the link went quiet".to_string()),
    }
}

fn handed(
    body: Bytes,
    progress: watch::Sender<Staging>,
) -> impl Stream<Item = Result<Bytes, std::io::Error>> {
    let unit = UNIT as usize;
    stream::unfold((0, progress), move |(at, progress)| {
        let body = body.clone();
        async move {
            if at >= body.len() {
                return None;
            }
            let end = (at + unit).min(body.len());
            let counted = if end == body.len() { end } else { at };
            progress.send_replace(Staging {
                stage: None,
                sent: counted as u64,
            });
            Some((Ok(body.slice(at..end)), (end, progress)))
        }
    })
}

async fn quiet(mut watched: watch::Receiver<Staging>, total: u64) {
    loop {
        let handed = watched.borrow().sent >= total;
        let wait = if handed { ANSWER_WAIT } else { QUIET };
        match tokio::time::timeout(wait, watched.changed()).await {
            Ok(Ok(())) => {}
            Ok(Err(_)) => {
                tokio::time::sleep(ANSWER_WAIT).await;
                return;
            }
            Err(_) => return,
        }
    }
}

fn client() -> Option<&'static wreq::Client> {
    static CLIENT: OnceLock<Option<wreq::Client>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            let (_, emulation) = sc_fingerprint::emulation(None);
            let builder = sc_fingerprint::from_emulation(fetch::pinging(emulation, Pace::Patient));
            system_proxy::follow(builder)
                .redirect(Policy::none())
                .connect_timeout(CONNECT_TIMEOUT)
                .build()
                .ok()
        })
        .as_ref()
}

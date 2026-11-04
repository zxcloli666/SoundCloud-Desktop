use std::sync::atomic::Ordering;
use std::time::Duration;

use crate::rt::AppHandle;

use super::events::Progress;
use super::failure::{BAD_LINK, Failure};
use super::matcher::match_list;
use super::model::{Cancel, ExtList};
use super::request::Request;
use super::source::{Source, detect};
use super::spotify;
use super::text;
use super::ym::{Ym, clean_token};
use super::ym_link::YmRef;
use super::youtube;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

pub fn build_client() -> Result<wreq::Client, Failure> {
    crate::network::system_proxy::follow(wreq::Client::builder())
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(Failure::unavailable)
}

pub async fn run(
    app: &AppHandle,
    request: Request,
    backend_url: &str,
    session_id: &str,
    cancel: &Cancel,
) -> Result<(), Failure> {
    let client = build_client()?;
    let reading = Progress {
        stage: "reading",
        ..Progress::default()
    };
    reading.emit(app);
    let on_read = |current: usize, total: usize| {
        Progress {
            current,
            total,
            ..reading.clone()
        }
        .emit(app)
    };

    let list = read(&client, request, cancel, &on_read).await?;
    if cancel.load(Ordering::Relaxed) {
        return Ok(());
    }

    let mut progress = Progress {
        stage: "matching",
        title: list.title.clone(),
        total: list.tracks.len(),
        partial: list.partial,
        ..Progress::default()
    };
    progress.emit(app);
    match_list(
        app,
        &client,
        backend_url,
        session_id,
        &list,
        cancel,
        &mut progress,
    )
    .await?;
    progress.emit(app);
    Ok(())
}

pub async fn read(
    client: &wreq::Client,
    request: Request,
    cancel: &Cancel,
    on_read: &(dyn Fn(usize, usize) + Send + Sync),
) -> Result<ExtList, Failure> {
    match request {
        Request::YmLikes { token } => {
            let token = clean_token(&token);
            Ym {
                client,
                token: Some(&token),
                cancel,
            }
            .likes(on_read)
            .await
        }
        Request::YmPlaylist {
            token,
            owner,
            playlist,
        } => {
            let token = clean_token(&token);
            let source = YmRef::UserPlaylist {
                owner,
                kind: playlist,
            };
            Ym {
                client,
                token: Some(&token),
                cancel,
            }
            .fetch(&source, on_read)
            .await
        }
        Request::Text { text } => text::parse(&text),
        Request::Link { url, token } => {
            let source = detect(&url).ok_or_else(|| Failure::new(BAD_LINK, url.clone()))?;
            read_link(client, source, token, cancel, on_read).await
        }
    }
}

async fn read_link(
    client: &wreq::Client,
    source: Source,
    token: Option<String>,
    cancel: &Cancel,
    on_read: &(dyn Fn(usize, usize) + Send + Sync),
) -> Result<ExtList, Failure> {
    match source {
        Source::Spotify(source) => spotify::fetch(client, &source).await,
        Source::YouTube(source) => youtube::fetch(client, &source, on_read).await,
        Source::Yandex(source) => {
            let token = token
                .map(|raw| clean_token(&raw))
                .filter(|token| !token.is_empty());
            Ym {
                client,
                token: token.as_deref(),
                cancel,
            }
            .fetch(&source, on_read)
            .await
        }
    }
}

//! Fast-start playback for uncached tracks.
//!
//! The network task appends progressive/HLS bytes to a growing buffer. Rodio
//! starts after a small lead-in instead of waiting for the complete track, while
//! the same bytes are committed to the regular cache when the transfer finishes.

mod buffer;
mod producer;

use std::time::{Duration, Instant};

use reqwest::{Client, Response};
use tauri::State;
use tokio::task::JoinHandle;

pub use buffer::StreamingReader;
use buffer::{StreamingBuffer, MIN_VALID_BYTES};
use producer::{context, is_current, pump_hls, pump_response};

use crate::audio::decode::create_player_from_stream;
use crate::audio::engine;
use crate::audio::state::AudioState;
use crate::audio::types::{AudioStreamLoadResult, AudioStreamRequest};
use crate::rt::AppHandle;
use crate::track_cache::direct_download::{resolve_candidates, Candidate};
use crate::track_cache::state::{DownloadSource, PlaybackQuality, TrackCacheState};

const MIN_START_BYTES: usize = 64 * 1024;
const START_TIMEOUT: Duration = Duration::from_secs(7);
const RESOLVE_TIMEOUT: Duration = Duration::from_secs(5);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(6);
/// Hard wall-clock budget for the whole uncached-track startup path. Individual
/// candidate timeouts are useful, but without an outer deadline their retries
/// accumulate and the UI looks stuck even though every single request is bounded.
const TOTAL_START_TIMEOUT: Duration = Duration::from_secs(16);
const RETRY_DELAY: Duration = Duration::from_millis(180);

/// Re-creatable view of the currently growing network buffer. Manual seeks use a
/// fresh reader so a failed seek can never corrupt or drain the player that is
/// already producing sound.
#[derive(Clone)]
pub(crate) struct ActiveStream {
    buffer: StreamingBuffer,
    mime: Option<String>,
    byte_len: Option<u64>,
}

impl ActiveStream {
    fn new(buffer: StreamingBuffer, mime: Option<String>, byte_len: Option<u64>) -> Self {
        Self {
            buffer,
            mime,
            byte_len,
        }
    }

    pub(crate) fn reader(&self) -> StreamingReader {
        self.buffer.reader()
    }

    pub(crate) fn mime(&self) -> Option<&str> {
        self.mime.as_deref()
    }

    pub(crate) fn byte_len(&self) -> Option<u64> {
        self.byte_len
    }
}

fn retryable_status(status: reqwest::StatusCode) -> bool {
    status.as_u16() == 429 || status.is_server_error()
}

async fn open_progressive(client: &Client, url: &str) -> Result<Response, String> {
    let mut last_error = "progressive request failed".to_string();
    for attempt in 0..2 {
        if attempt > 0 {
            tokio::time::sleep(RETRY_DELAY).await;
        }
        match tokio::time::timeout(REQUEST_TIMEOUT, client.get(url).send()).await {
            Ok(Ok(response)) if response.status().is_success() => return Ok(response),
            Ok(Ok(response)) => {
                last_error = format!("progressive HTTP {}", response.status());
                if !retryable_status(response.status()) {
                    return Err(last_error);
                }
            }
            Ok(Err(error)) => last_error = format!("progressive request: {error}"),
            Err(_) => last_error = "progressive request timed out".to_string(),
        }
    }
    Err(last_error)
}

async fn wait_for_start(
    buffer: &StreamingBuffer,
    app: &AppHandle,
    generation: u64,
) -> Result<(), String> {
    let deadline = Instant::now() + START_TIMEOUT;
    loop {
        if !is_current(app, generation) {
            return Err("load cancelled".to_string());
        }
        let (length, complete, error) = buffer.status();
        if let Some(error) = error {
            return Err(error);
        }
        if length >= MIN_START_BYTES || (complete && length >= MIN_VALID_BYTES) {
            return Ok(());
        }
        if complete {
            return Err("stream ended before it contained playable audio".to_string());
        }
        if Instant::now() >= deadline {
            return Err("timed out waiting for the initial audio buffer".to_string());
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
}

async fn install_buffer(
    buffer: &StreamingBuffer,
    mime: Option<String>,
    byte_len: Option<u64>,
    start_paused: bool,
    app: &AppHandle,
    generation: u64,
    state: &AudioState,
) -> Result<(), String> {
    wait_for_start(buffer, app, generation).await?;
    let active_stream = ActiveStream::new(buffer.clone(), mime.clone(), byte_len);
    let reader = buffer.reader();
    let mixer = state.mixer.lock().unwrap().clone();
    let volume = *state.volume.lock().unwrap();
    let eq_params = state.eq_params.clone();
    let analyser = state.analyser_buffer.clone();
    let player = tokio::task::spawn_blocking(move || {
        create_player_from_stream(
            reader,
            mime.as_deref(),
            byte_len,
            &mixer,
            volume,
            start_paused,
            eq_params,
            analyser,
        )
    })
    .await
    .map_err(|error| format!("stream decoder task: {error}"))??;

    if !is_current(app, generation) {
        player.stop();
        return Err("load cancelled".to_string());
    }
    engine::install_streaming_player(state, player);
    *state.active_stream.lock().unwrap() = Some(active_stream);
    Ok(())
}

async fn try_direct_candidate(
    candidate: Candidate,
    client: &Client,
    app: &AppHandle,
    cache: &TrackCacheState,
    urn: &str,
    generation: u64,
    expected_duration_ms: Option<u64>,
    start_paused: bool,
    state: &AudioState,
) -> Result<AudioStreamLoadResult, String> {
    let quality = candidate.playback_quality();
    let producer_context = context(
        app,
        cache,
        urn,
        generation,
        quality,
        DownloadSource::Direct,
        expected_duration_ms,
    );
    let buffer = StreamingBuffer::new();

    let (mime, byte_len, producer): (Option<String>, Option<u64>, JoinHandle<()>) = match candidate {
        Candidate::Progressive { mime, url, .. } => {
            let response = open_progressive(client, &url).await?;
            let byte_len = response.content_length();
            let mime = (!mime.is_empty()).then_some(mime).or_else(|| {
                response
                    .headers()
                    .get("content-type")?
                    .to_str()
                    .ok()
                    .map(str::to_string)
            });
            let task_buffer = buffer.clone();
            (
                mime,
                byte_len,
                tokio::spawn(pump_response(response, task_buffer, producer_context)),
            )
        }
        Candidate::Hls {
            mime,
            manifest_url,
            ..
        } => {
            let task_buffer = buffer.clone();
            let task_client = client.clone();
            (
                (!mime.is_empty()).then_some(mime),
                None,
                tokio::spawn(pump_hls(
                    task_client,
                    manifest_url,
                    task_buffer,
                    producer_context,
                )),
            )
        }
        Candidate::Unsupported => return Err("unsupported stream candidate".to_string()),
    };

    match install_buffer(
        &buffer,
        mime,
        byte_len,
        start_paused,
        app,
        generation,
        state,
    )
    .await
    {
        Ok(()) => {
            engine::set_stream_task(state, producer);
            Ok(AudioStreamLoadResult {
                duration_secs: None,
                quality: quality.label().to_string(),
                source: DownloadSource::Direct.label().to_string(),
            })
        }
        Err(error) => {
            producer.abort();
            Err(error)
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn try_direct_candidates(
    candidates: Vec<Candidate>,
    client: &Client,
    app: &AppHandle,
    cache: &TrackCacheState,
    urn: &str,
    generation: u64,
    expected_duration_ms: Option<u64>,
    start_paused: bool,
    state: &AudioState,
) -> Result<AudioStreamLoadResult, String> {
    let mut last_error = "no direct stream candidate succeeded".to_string();
    for candidate in candidates {
        let attempts = if candidate.kind_label() == "hls" { 2 } else { 1 };
        for attempt in 0..attempts {
            if !is_current(app, generation) {
                return Err("load cancelled".to_string());
            }
            if attempt > 0 {
                tokio::time::sleep(RETRY_DELAY).await;
            }
            match try_direct_candidate(
                candidate.clone(),
                client,
                app,
                cache,
                urn,
                generation,
                expected_duration_ms,
                start_paused,
                state,
            )
            .await
            {
                Ok(result) => return Ok(result),
                Err(error) => last_error = error,
            }
        }
    }
    Err(last_error)
}

async fn load_inner(
    request: AudioStreamRequest,
    start_paused: bool,
    app: &AppHandle,
    state: &AudioState,
    cache: &TrackCacheState,
) -> Result<AudioStreamLoadResult, String> {
    let generation = state
        .load_gen
        .load(std::sync::atomic::Ordering::Relaxed);
    *state.source_bytes.lock().unwrap() = None;
    let mut last_error = "no fast stream source succeeded".to_string();

    if let Some(candidates) = cache.take_preloaded_candidates(&request.urn) {
        match try_direct_candidates(
            candidates,
            &cache.direct_client,
            app,
            cache,
            &request.urn,
            generation,
            request.duration_ms,
            start_paused,
            state,
        )
        .await
        {
            Ok(result) => return Ok(result),
            Err(error) => last_error = error,
        }
    }

    let resolve = tokio::time::timeout(
        RESOLVE_TIMEOUT,
        resolve_candidates(
            &cache.direct_client,
            &request.download_urls,
            request.session_id.as_deref(),
            request.hq,
        ),
    )
    .await;
    match resolve {
        Ok(Ok(candidates)) => {
            match try_direct_candidates(
                candidates,
                &cache.direct_client,
                app,
                cache,
                &request.urn,
                generation,
                request.duration_ms,
                start_paused,
                state,
            )
            .await
            {
                Ok(result) => return Ok(result),
                Err(error) => last_error = error,
            }
        }
        Ok(Err(error)) => last_error = error,
        Err(_) => last_error = "stream resolve timed out".to_string(),
    }

    for url in &request.urls {
        for attempt in 0..2 {
            if !is_current(app, generation) {
                return Err("load cancelled".to_string());
            }
            if attempt > 0 {
                tokio::time::sleep(RETRY_DELAY).await;
            }
            let response = match tokio::time::timeout(
                REQUEST_TIMEOUT,
                crate::network::audio_route::get(
                    &cache.client,
                    url,
                    request.session_id.as_deref(),
                ),
            )
            .await
            {
                Ok(Ok((response, _))) if response.status().is_success() => response,
                Ok(Ok((response, _))) => {
                    let status = response.status();
                    last_error = format!("stream API HTTP {status}");
                    if !retryable_status(status) {
                        break;
                    }
                    continue;
                }
                Ok(Err(error)) => {
                    last_error = error;
                    continue;
                }
                Err(_) => {
                    last_error = "stream API request timed out".to_string();
                    continue;
                }
            };
            let mime = response
                .headers()
                .get("content-type")
                .and_then(|value| value.to_str().ok())
                .map(str::to_string);
            let byte_len = response.content_length();
            let quality = if request.hq {
                PlaybackQuality::Hq
            } else {
                PlaybackQuality::Sq
            };
            let producer_context = context(
                app,
                cache,
                &request.urn,
                generation,
                quality,
                DownloadSource::Api,
                request.duration_ms,
            );
            let buffer = StreamingBuffer::new();
            let producer = tokio::spawn(pump_response(response, buffer.clone(), producer_context));
            match install_buffer(
                &buffer,
                mime,
                byte_len,
                start_paused,
                app,
                generation,
                state,
            )
            .await
            {
                Ok(()) => {
                    engine::set_stream_task(state, producer);
                    return Ok(AudioStreamLoadResult {
                        duration_secs: None,
                        quality: quality.label().to_string(),
                        source: DownloadSource::Api.label().to_string(),
                    });
                }
                Err(error) => {
                    producer.abort();
                    last_error = error;
                }
            }
        }
    }

    Err(last_error)
}

pub async fn load(
    request: AudioStreamRequest,
    start_paused: bool,
    app: AppHandle,
    state: State<'_, AudioState>,
    cache: State<'_, TrackCacheState>,
) -> Result<AudioStreamLoadResult, String> {
    match tokio::time::timeout(
        TOTAL_START_TIMEOUT,
        load_inner(
            request,
            start_paused,
            &app,
            state.inner(),
            cache.inner(),
        ),
    )
    .await
    {
        Ok(result) => result,
        Err(_) => {
            // Invalidate any detached producer spawned by the timed-out future
            // and clear partial player/buffer state before the UI retries SQ.
            engine::stop_state(state.inner());
            Err(format!(
                "track start timed out after {} seconds",
                TOTAL_START_TIMEOUT.as_secs()
            ))
        }
    }
}

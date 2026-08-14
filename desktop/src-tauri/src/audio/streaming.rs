//! Fast-start playback for uncached tracks.
//!
//! The network task appends progressive/HLS bytes to a growing buffer. Rodio
//! starts after a small lead-in instead of waiting for the complete track, while
//! the same bytes are committed to the regular cache when the transfer finishes.

mod buffer;
mod producer;

use std::time::{Duration, Instant};

use reqwest::Client;
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

const MIN_START_BYTES: usize = 128 * 1024;
const START_TIMEOUT: Duration = Duration::from_secs(15);
const RESOLVE_TIMEOUT: Duration = Duration::from_secs(12);

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
    start_paused: bool,
    app: &AppHandle,
    generation: u64,
    state: &AudioState,
) -> Result<(), String> {
    wait_for_start(buffer, app, generation).await?;
    let reader = buffer.reader();
    let mixer = state.mixer.lock().unwrap().clone();
    let volume = *state.volume.lock().unwrap();
    let eq_params = state.eq_params.clone();
    let analyser = state.analyser_buffer.clone();
    let player = tokio::task::spawn_blocking(move || {
        create_player_from_stream(
            reader,
            mime.as_deref(),
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

    let (mime, producer): (Option<String>, JoinHandle<()>) = match candidate {
        Candidate::Progressive { mime, url, .. } => {
            let response = client
                .get(&url)
                .send()
                .await
                .map_err(|error| format!("progressive request: {error}"))?;
            if !response.status().is_success() {
                return Err(format!("progressive HTTP {}", response.status()));
            }
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

    match install_buffer(&buffer, mime, start_paused, app, generation, state).await {
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

pub async fn load(
    request: AudioStreamRequest,
    start_paused: bool,
    app: AppHandle,
    state: State<'_, AudioState>,
    cache: State<'_, TrackCacheState>,
) -> Result<AudioStreamLoadResult, String> {
    let generation = state
        .load_gen
        .load(std::sync::atomic::Ordering::Relaxed);
    *state.source_bytes.lock().unwrap() = None;
    let mut last_error = "no fast stream source succeeded".to_string();

    let resolve = tokio::time::timeout(
        RESOLVE_TIMEOUT,
        resolve_candidates(
            &cache.direct_client,
            &request.download_urls,
            request.session_id.as_deref(),
            request.hq,
        ),
    );
    if let Ok(Ok(candidates)) = resolve.await {
        for candidate in candidates {
            if !is_current(&app, generation) {
                return Err("load cancelled".to_string());
            }
            match try_direct_candidate(
                candidate,
                &cache.direct_client,
                &app,
                &cache,
                &request.urn,
                generation,
                request.duration_ms,
                start_paused,
                &state,
            )
            .await
            {
                Ok(result) => return Ok(result),
                Err(error) => last_error = error,
            }
        }
    }

    for url in &request.urls {
        if !is_current(&app, generation) {
            return Err("load cancelled".to_string());
        }
        let response = match crate::network::audio_route::get(
            &cache.client,
            url,
            request.session_id.as_deref(),
        )
        .await
        {
            Ok((response, _)) if response.status().is_success() => response,
            Ok((response, _)) => {
                last_error = format!("stream API HTTP {}", response.status());
                continue;
            }
            Err(error) => {
                last_error = error;
                continue;
            }
        };
        let mime = response
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok())
            .map(str::to_string);
        let quality = if request.hq {
            PlaybackQuality::Hq
        } else {
            PlaybackQuality::Sq
        };
        let producer_context = context(
            &app,
            &cache,
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
            start_paused,
            &app,
            generation,
            &state,
        )
        .await
        {
            Ok(()) => {
                engine::set_stream_task(&state, producer);
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

    Err(last_error)
}

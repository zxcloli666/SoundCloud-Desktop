use futures_util::StreamExt;
use reqwest::{Client, Response};
use tauri::{Emitter, Manager};

use std::time::{Duration, Instant};

use super::buffer::{StreamingBuffer, MIN_VALID_BYTES};
use crate::audio::state::AudioState;
use crate::rt::AppHandle;
use crate::track_cache::sc_anon::hls::{fetch_bytes, parse_m3u8};
use crate::track_cache::state::{DownloadSource, PlaybackQuality, TrackCacheState};

#[derive(Clone)]
pub(super) struct ProducerContext {
    app: AppHandle,
    cache: TrackCacheState,
    urn: String,
    generation: u64,
    quality: PlaybackQuality,
    source: DownloadSource,
    expected_duration_ms: Option<u64>,
}

const STREAM_CHUNK_TIMEOUT_MS: u64 = 12_000;
const PROGRESS_EMIT_INTERVAL: Duration = Duration::from_millis(200);
const PROGRESS_EMIT_STEP: f64 = 0.02;

#[derive(Default)]
struct ProgressThrottle {
    last_at: Option<Instant>,
    last_value: f64,
}

pub(super) fn context(
    app: &AppHandle,
    cache: &TrackCacheState,
    urn: &str,
    generation: u64,
    quality: PlaybackQuality,
    source: DownloadSource,
    expected_duration_ms: Option<u64>,
) -> ProducerContext {
    ProducerContext {
        app: app.clone(),
        cache: cache.clone(),
        urn: urn.to_string(),
        generation,
        quality,
        source,
        expected_duration_ms,
    }
}

pub(super) fn is_current(app: &AppHandle, generation: u64) -> bool {
    app.state::<AudioState>()
        .load_gen
        .load(std::sync::atomic::Ordering::Relaxed)
        == generation
}

fn emit_progress(
    context: &ProducerContext,
    downloaded: u64,
    total: u64,
    throttle: &mut ProgressThrottle,
    force: bool,
) {
    if total == 0 {
        return;
    }
    let progress = (downloaded as f64 / total as f64).min(1.0);
    let now = Instant::now();
    if !force
        && let Some(last_at) = throttle.last_at
        && (now.duration_since(last_at) < PROGRESS_EMIT_INTERVAL
            || progress - throttle.last_value < PROGRESS_EMIT_STEP)
    {
        return;
    }
    throttle.last_at = Some(now);
    throttle.last_value = progress;
    let _ = context.app.emit(
        "track:download-progress",
        serde_json::json!({
            "urn": context.urn,
            "downloaded": downloaded,
            "total": total,
            "progress": progress,
            "source": context.source.label(),
        }),
    );
}

async fn commit_finished(buffer: &StreamingBuffer, context: &ProducerContext) {
    if !is_current(&context.app, context.generation) {
        return;
    }
    let data = buffer.snapshot();
    if data.len() < MIN_VALID_BYTES {
        return;
    }

    // Device reconnects and seeks can rebuild from memory as soon as the transfer
    // completes, even if the disk cache/transcode is still catching up.
    let audio = context.app.state::<AudioState>();
    // Lock both destinations before the final generation check. If a newer load
    // increments `load_gen`, it either wins before this check (we abort) or waits
    // for these locks and clears our data afterwards. An old producer can no
    // longer overwrite the source of the newly selected track.
    {
        let mut source_bytes = audio.source_bytes.lock().unwrap();
        let mut active_stream = audio.active_stream.lock().unwrap();
        if !is_current(&context.app, context.generation) {
            return;
        }
        *source_bytes = Some(data.clone());
        // The complete byte source is now the canonical seek fallback. Dropping this
        // handle only releases our extra Arc; the live decoder keeps its own reader.
        *active_stream = None;
    }

    if let Err(error) = context
        .cache
        .store_streamed_bytes(
            &context.urn,
            &data,
            context.quality,
            context.source,
            context.expected_duration_ms,
        )
        .await
    {
        eprintln!("[AudioStream] cache {} failed: {error}", context.urn);
    }
}

pub(super) async fn pump_response(
    response: Response,
    buffer: StreamingBuffer,
    context: ProducerContext,
) {
    let total = response.content_length().unwrap_or(0);
    let mut downloaded = 0u64;
    let mut progress_throttle = ProgressThrottle::default();
    let mut stream = response.bytes_stream();
    loop {
        let chunk = match tokio::time::timeout(
            Duration::from_millis(STREAM_CHUNK_TIMEOUT_MS),
            stream.next(),
        )
        .await
        {
            Ok(Some(Ok(chunk))) => chunk,
            Ok(Some(Err(error))) => {
                buffer.fail(format!("stream body: {error}"));
                return;
            }
            Ok(None) => break,
            Err(_) => {
                buffer.fail(format!("stream body timed out"));
                return;
            }
        };
        if !is_current(&context.app, context.generation) {
            buffer.fail("stream cancelled".to_string());
            return;
        }
        downloaded += chunk.len() as u64;
        buffer.push(&chunk);
        emit_progress(
            &context,
            downloaded,
            total,
            &mut progress_throttle,
            false,
        );
    }
    if total > 0 && downloaded != total {
        buffer.fail(format!(
            "stream ended early: received {downloaded} of {total} bytes"
        ));
        return;
    }
    buffer.finish();
    emit_progress(
        &context,
        downloaded,
        downloaded.max(total),
        &mut progress_throttle,
        true,
    );
    commit_finished(&buffer, &context).await;
}

pub(super) async fn pump_hls(
    client: Client,
    manifest_url: String,
    buffer: StreamingBuffer,
    context: ProducerContext,
) {
    let manifest = match fetch_bytes(&client, &manifest_url).await {
        Ok(bytes) => bytes,
        Err(error) => {
            buffer.fail(format!("HLS manifest: {error}"));
            return;
        }
    };
    let manifest_text = String::from_utf8_lossy(&manifest);
    let (init_url, segments) = parse_m3u8(&manifest_text, &manifest_url);
    if segments.is_empty() {
        buffer.fail("HLS manifest has no segments".to_string());
        return;
    }

    if let Some(init_url) = init_url {
        match fetch_bytes(&client, &init_url).await {
            Ok(bytes) => buffer.push(&bytes),
            Err(error) => {
                buffer.fail(format!("HLS init: {error}"));
                return;
            }
        }
    }

    let total = segments.len() as u64;
    let mut progress_throttle = ProgressThrottle::default();
    for (index, segment_url) in segments.into_iter().enumerate() {
        if !is_current(&context.app, context.generation) {
            buffer.fail("stream cancelled".to_string());
            return;
        }
        match fetch_bytes(&client, &segment_url).await {
            Ok(bytes) => {
                buffer.push(&bytes);
                emit_progress(
                    &context,
                    index as u64 + 1,
                    total,
                    &mut progress_throttle,
                    index as u64 + 1 == total,
                );
            }
            Err(error) => {
                buffer.fail(format!("HLS segment {}: {error}", index + 1));
                return;
            }
        }
    }
    buffer.finish();
    commit_finished(&buffer, &context).await;
}

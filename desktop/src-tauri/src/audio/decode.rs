use std::collections::VecDeque;
use std::io::{Cursor, Read, Seek, SeekFrom};
use std::num::NonZero;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicU32;
use std::sync::{Arc, RwLock};
use std::time::Duration;

use rodio::decoder::DecoderError;
use rodio::mixer::Mixer;
use rodio::source::SeekError;
use rodio::{Decoder, Player, Source};
use sha2::{Digest, Sha256};

use crate::audio::analyser::{AnalyserBuffer, AnalyserSource};
use crate::audio::declick::DeclickSource;
use crate::audio::eq::{EqSource, GainSource};
use crate::audio::pitch::PitchSource;
use crate::audio::types::{
    ChannelCount, EqParams, SampleRate, NORMALIZATION_ANALYSIS_SAMPLES,
    NORMALIZATION_BLOCK_SAMPLES, NORMALIZATION_MAX_ATTENUATION_DB, NORMALIZATION_MAX_BOOST_DB,
    NORMALIZATION_SEEK_PREROLL_SAMPLES, NORMALIZATION_SPREAD_MIN_SECS, NORMALIZATION_TARGET_PEAK,
    NORMALIZATION_TARGET_RMS, NORMALIZATION_WINDOWS,
};

const NORMALIZATION_CACHE_VERSION: u8 = 3;

pub fn is_ogg_opus(bytes: &[u8]) -> bool {
    // OpusHead appears at byte 28 in a standard OGG Opus header page
    bytes.len() >= 36
        && &bytes[0..4] == b"OggS"
        && bytes[..bytes.len().min(64)]
            .windows(8)
            .any(|w| w == b"OpusHead")
}

fn is_mpeg_audio(bytes: &[u8]) -> bool {
    let start = match bytes.get(..10) {
        Some(tag) if tag.starts_with(b"ID3") => {
            let size = tag[6..10]
                .iter()
                .fold(0usize, |size, &byte| (size << 7) | (byte & 0x7F) as usize);
            let footer = if tag[5] & 0x10 != 0 { 10 } else { 0 };
            10 + size + footer
        }
        _ => 0,
    };
    matches!(bytes.get(start..start + 2), Some(&[0xFF, sync]) if sync & 0xE0 == 0xE0)
}

const OPUS_MAX_PACKET_FRAMES: usize = 5760;
const OGG_PAGE_HEADER_LEN: usize = 27;
const OGG_TAIL_SCAN_BYTES: u64 = 128 * 1024;

fn last_granule<R: Read + Seek>(reader: &mut R) -> Option<u64> {
    let mut first_page = [0u8; OGG_PAGE_HEADER_LEN];
    reader.read_exact(&mut first_page).ok()?;
    let serial = &first_page[14..18];
    let end = reader.seek(SeekFrom::End(0)).ok()?;
    reader
        .seek(SeekFrom::Start(end.saturating_sub(OGG_TAIL_SCAN_BYTES)))
        .ok()?;
    let mut tail = Vec::new();
    reader.read_to_end(&mut tail).ok()?;
    tail.windows(OGG_PAGE_HEADER_LEN).rev().find_map(|page| {
        let granule = u64::from_le_bytes(page[6..14].try_into().ok()?);
        let is_ours = page.starts_with(b"OggS") && page[4] == 0 && &page[14..18] == serial;
        (is_ours && granule != u64::MAX).then_some(granule)
    })
}

struct OpusSource<R: std::io::Read + std::io::Seek> {
    reader: ogg::reading::PacketReader<R>,
    decoder: audiopus::coder::Decoder,
    channels: ChannelCount,
    buffer: Vec<f32>,
    buf_pos: usize,
    serial: u32,
    pre_skip: u64,
    skip: usize,
    pending: VecDeque<Vec<u8>>,
    total_duration: Option<Duration>,
}

impl OpusSource<Cursor<Vec<u8>>> {
    fn new(data: Vec<u8>) -> Result<Self, String> {
        Self::from_reader(Cursor::new(data))
    }
}

impl<R: std::io::Read + std::io::Seek> OpusSource<R> {
    fn from_reader(mut reader: R) -> Result<Self, String> {
        let end_granule = last_granule(&mut reader);
        reader
            .rewind()
            .map_err(|e| format!("OGG read error: {}", e))?;
        let mut reader = ogg::reading::PacketReader::new(reader);

        let head_pkt = reader
            .read_packet()
            .map_err(|e| format!("OGG read error: {}", e))?
            .ok_or("No OpusHead packet")?;

        let head = &head_pkt.data;
        if head.len() < 19 || &head[..8] != b"OpusHead" {
            return Err("Invalid OpusHead".into());
        }

        let serial = head_pkt.stream_serial();
        let ch_count = head[9];
        let pre_skip = u16::from_le_bytes([head[10], head[11]]) as usize;
        let opus_ch = if ch_count == 1 {
            audiopus::Channels::Mono
        } else {
            audiopus::Channels::Stereo
        };

        reader
            .read_packet()
            .map_err(|e| format!("OGG read error: {}", e))?;

        let decoder = audiopus::coder::Decoder::new(audiopus::SampleRate::Hz48000, opus_ch)
            .map_err(|e| format!("Opus decoder error: {:?}", e))?;

        let channel_count = if ch_count == 1 { 1u16 } else { 2u16 };
        let total_duration = end_granule
            .map(|granule| granule.saturating_sub(pre_skip as u64) as f64 / 48000.0)
            .map(Duration::from_secs_f64)
            .filter(|duration| !duration.is_zero());

        Ok(Self {
            reader,
            decoder,
            channels: NonZero::new(channel_count).unwrap(),
            buffer: Vec::new(),
            buf_pos: 0,
            serial,
            pre_skip: pre_skip as u64,
            skip: pre_skip * channel_count as usize,
            pending: VecDeque::new(),
            total_duration,
        })
    }

    fn next_packet(&mut self) -> Option<Vec<u8>> {
        if let Some(data) = self.pending.pop_front() {
            return Some(data);
        }
        self.reader.read_packet().ok().flatten().map(|packet| packet.data)
    }

    fn decode_next_packet(&mut self) -> bool {
        while let Some(data) = self.next_packet() {
            if data.is_empty() {
                continue;
            }
            let channels = self.channels.get() as usize;
            let mut buf = vec![0f32; OPUS_MAX_PACKET_FRAMES * channels];
            let Ok(samples_per_ch) = self.decoder.decode_float(Some(&data), &mut buf, false) else {
                continue;
            };
            let total = samples_per_ch * channels;
            buf.truncate(total);

            let skip = self.skip.min(total);
            self.skip -= skip;
            if skip == total {
                continue;
            }
            buf.drain(..skip);
            self.buffer = buf;
            self.buf_pos = 0;
            return true;
        }
        false
    }

    fn queue_first_page(&mut self) -> Option<u64> {
        self.pending.clear();
        let mut frames = 0;
        while let Ok(Some(packet)) = self.reader.read_packet() {
            frames += audiopus::packet::nb_samples(&packet.data, audiopus::SampleRate::Hz48000)
                .ok()
                .filter(|&count| count <= OPUS_MAX_PACKET_FRAMES)
                .unwrap_or(0) as u64;
            let page_end = packet.absgp_page();
            let last_in_page = packet.last_in_page();
            self.pending.push_back(packet.data);
            if last_in_page {
                return Some(page_end.saturating_sub(frames));
            }
        }
        None
    }
}

impl<R: std::io::Read + std::io::Seek> Iterator for OpusSource<R> {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        if self.buf_pos >= self.buffer.len() && !self.decode_next_packet() {
            return None;
        }
        let sample = self.buffer[self.buf_pos];
        self.buf_pos += 1;
        Some(sample)
    }
}

impl<R: std::io::Read + std::io::Seek> Source for OpusSource<R> {
    fn current_span_len(&self) -> Option<usize> {
        None
    }

    fn channels(&self) -> ChannelCount {
        self.channels
    }

    fn sample_rate(&self) -> SampleRate {
        NonZero::new(48000).unwrap()
    }

    fn total_duration(&self) -> Option<Duration> {
        self.total_duration
    }

    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        let target_gp = (pos.as_secs_f64() * 48000.0) as u64 + self.pre_skip;

        match self.reader.seek_absgp(Some(self.serial), target_gp) {
            Ok(true) => {
                let opus_ch = if self.channels.get() == 1 {
                    audiopus::Channels::Mono
                } else {
                    audiopus::Channels::Stereo
                };
                self.decoder =
                    audiopus::coder::Decoder::new(audiopus::SampleRate::Hz48000, opus_ch).map_err(
                        |_| SeekError::NotSupported {
                            underlying_source: "opus decoder reinit failed",
                        },
                    )?;
                self.buffer.clear();
                self.buf_pos = 0;
                let page_start = self.queue_first_page().unwrap_or(target_gp);
                self.skip = target_gp.saturating_sub(page_start) as usize * self.channels.get() as usize;
                Ok(())
            }
            Ok(false) | Err(_) => Err(SeekError::NotSupported {
                underlying_source: "ogg seek failed",
            }),
        }
    }
}

fn decode_bytes(bytes: &[u8]) -> Result<Decoder<Cursor<Vec<u8>>>, DecoderError> {
    let builder = Decoder::builder().with_data(Cursor::new(bytes.to_vec()));
    let builder = if is_mpeg_audio(bytes) {
        builder.with_seekable(true)
    } else {
        builder.with_byte_len(bytes.len() as u64)
    };
    builder
        .build()
        .or_else(|_| Decoder::new(Cursor::new(bytes.to_vec())))
}

fn normalization_cache_file(cache_dir: &Path, cache_key: &str) -> PathBuf {
    let mut hasher = Sha256::new();
    hasher.update(cache_key.as_bytes());
    let hash = hex::encode(hasher.finalize());
    cache_dir.join(format!("{hash}.gain"))
}

fn read_cached_normalization_gain(
    cache_dir: Option<&Path>,
    cache_key: Option<&str>,
) -> Option<f32> {
    let path = normalization_cache_file(cache_dir?, cache_key?);
    let raw = std::fs::read_to_string(path).ok()?;
    let (version, value) = raw.trim().split_once(':')?;
    if version != NORMALIZATION_CACHE_VERSION.to_string() {
        return None;
    }
    value.parse::<f32>().ok()
}

fn write_cached_normalization_gain(cache_dir: Option<&Path>, cache_key: Option<&str>, gain: f32) {
    let Some(cache_dir) = cache_dir else {
        return;
    };
    let Some(cache_key) = cache_key else {
        return;
    };

    if std::fs::create_dir_all(cache_dir).is_err() {
        return;
    }

    let path = normalization_cache_file(cache_dir, cache_key);
    let _ = std::fs::write(path, format!("{NORMALIZATION_CACHE_VERSION}:{gain:.6}"));
}

fn spread_samples<S: Source<Item = f32>>(mut source: S) -> impl Iterator<Item = f32> {
    let total = source.total_duration().unwrap_or_default();
    let spread = total.as_secs() >= NORMALIZATION_SPREAD_MIN_SECS;
    let window = NORMALIZATION_ANALYSIS_SAMPLES / NORMALIZATION_WINDOWS;
    let mut index = 0;
    let mut left = 0;
    std::iter::from_fn(move || {
        if left == 0 {
            if index == NORMALIZATION_WINDOWS {
                return None;
            }
            let at = total.mul_f64((index as f64 + 0.5) / NORMALIZATION_WINDOWS as f64);
            if spread && source.try_seek(at).is_ok() {
                source.by_ref().take(NORMALIZATION_SEEK_PREROLL_SAMPLES).for_each(drop);
            }
            index += 1;
            left = window;
        }
        left -= 1;
        source.next()
    })
}

fn normalization_gain_from_samples<S: Source<Item = f32>>(source: S) -> f32 {
    let mut peak = 0.0f64;
    let mut count = 0usize;
    let mut block_sum_sq = 0.0f64;
    let mut block_count = 0usize;
    let mut block_powers = Vec::new();

    for sample in spread_samples(source) {
        let value = sample as f64;
        let abs = value.abs();
        peak = peak.max(abs);
        block_sum_sq += value * value;
        block_count += 1;
        count += 1;

        if block_count >= NORMALIZATION_BLOCK_SAMPLES {
            block_powers.push(block_sum_sq / block_count as f64);
            block_sum_sq = 0.0;
            block_count = 0;
        }
    }

    if block_count > 0 {
        block_powers.push(block_sum_sq / block_count as f64);
    }

    if count == 0 {
        return 1.0;
    }

    if block_powers.is_empty() {
        return 1.0;
    }

    block_powers.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let keep_from = ((block_powers.len() as f64) * 0.4).floor() as usize;
    let kept = &block_powers[keep_from.min(block_powers.len().saturating_sub(1))..];
    let gated_power = kept.iter().copied().sum::<f64>() / kept.len() as f64;
    let rms = gated_power.sqrt().max(1e-6);
    let target_gain = NORMALIZATION_TARGET_RMS / rms;
    let peak_safe_gain = if peak > 0.0 {
        NORMALIZATION_TARGET_PEAK / peak
    } else {
        target_gain
    };

    let max_boost = 10f64.powf(NORMALIZATION_MAX_BOOST_DB / 20.0);
    let max_attenuation = 10f64.powf(NORMALIZATION_MAX_ATTENUATION_DB / 20.0);
    let gain = target_gain
        .min(peak_safe_gain)
        .clamp(max_attenuation, max_boost);

    if (gain - 1.0).abs() < 0.05 {
        1.0
    } else {
        gain as f32
    }
}

pub fn resolve_normalization_gain(
    bytes: &[u8],
    cache_dir: Option<&Path>,
    cache_key: Option<&str>,
) -> Result<f32, String> {
    if let Some(gain) = read_cached_normalization_gain(cache_dir, cache_key) {
        return Ok(gain);
    }

    let gain = if is_ogg_opus(bytes) {
        normalization_gain_from_samples(
            OpusSource::new(bytes.to_vec()).map_err(|e| format!("Failed to decode: {}", e))?,
        )
    } else { match decode_bytes(bytes) { Ok(source) => {
        normalization_gain_from_samples(source)
    } _ => {
        normalization_gain_from_samples(
            OpusSource::new(bytes.to_vec()).map_err(|e| format!("Failed to decode: {}", e))?,
        )
    }}};

    write_cached_normalization_gain(cache_dir, cache_key, gain);
    Ok(gain)
}

#[allow(clippy::too_many_arguments)]
pub fn create_player_from_bytes(
    bytes: &[u8],
    mixer: &Mixer,
    volume: f32,
    normalization_gain: f32,
    start_paused: bool,
    eq_params: Arc<RwLock<EqParams>>,
    analyser_buffer: Arc<AnalyserBuffer>,
    pitch_ratio: Arc<AtomicU32>,
) -> Result<(Player, Option<f64>), String> {
    let player = Player::connect_new(mixer);
    player.set_volume(volume);
    if start_paused {
        player.pause();
    }

    let source: Box<dyn Source + Send> = if is_ogg_opus(bytes) {
        Box::new(OpusSource::new(bytes.to_vec()).map_err(|e| format!("Failed to decode: {}", e))?)
    } else if let Ok(decoder) = decode_bytes(bytes) {
        Box::new(decoder)
    } else {
        Box::new(OpusSource::new(bytes.to_vec()).map_err(|e| format!("Failed to decode: {}", e))?)
    };
    let duration = source.total_duration().map(|d| d.as_secs_f64());
    player.append(DeclickSource::new(AnalyserSource::new(
        EqSource::new(
            PitchSource::new(GainSource::new(source, normalization_gain), pitch_ratio),
            eq_params,
        ),
        analyser_buffer,
    )));

    Ok((player, duration))
}

#[cfg(test)]
mod tests {
    use ogg::writing::{PacketWriteEndInfo, PacketWriter};

    use super::*;

    const RATE: usize = 48_000;
    const PACKET_FRAMES: usize = 960;
    const PACKETS_PER_PAGE: usize = 50;
    const SERIAL: u32 = 7;

    fn chirp(frame: usize) -> f32 {
        let t = frame as f32 / RATE as f32;
        (std::f32::consts::TAU * (200.0 * t + 150.0 * t * t)).sin() * 0.5
    }

    fn opus_stream(seconds: usize) -> Vec<u8> {
        let encoder = audiopus::coder::Encoder::new(
            audiopus::SampleRate::Hz48000,
            audiopus::Channels::Stereo,
            audiopus::Application::Audio,
        )
        .unwrap();
        let pre_skip = encoder.lookahead().unwrap() as u16;
        let mut writer = PacketWriter::new(Cursor::new(Vec::new()));

        let mut head = b"OpusHead".to_vec();
        head.extend([1, 2]);
        head.extend(pre_skip.to_le_bytes());
        head.extend((RATE as u32).to_le_bytes());
        head.extend([0, 0, 0]);
        writer
            .write_packet(head, SERIAL, PacketWriteEndInfo::EndPage, 0)
            .unwrap();
        let mut tags = b"OpusTags".to_vec();
        tags.extend([0; 8]);
        writer
            .write_packet(tags, SERIAL, PacketWriteEndInfo::EndPage, 0)
            .unwrap();

        let packets = seconds * RATE / PACKET_FRAMES;
        for index in 0..packets {
            let pcm = (0..PACKET_FRAMES)
                .flat_map(|i| {
                    let value = chirp(index * PACKET_FRAMES + i);
                    [value, value]
                })
                .collect::<Vec<_>>();
            let mut data = vec![0u8; 4000];
            let len = encoder.encode_float(&pcm, &mut data).unwrap();
            data.truncate(len);
            let end = if index + 1 == packets {
                PacketWriteEndInfo::EndStream
            } else if (index + 1) % PACKETS_PER_PAGE == 0 {
                PacketWriteEndInfo::EndPage
            } else {
                PacketWriteEndInfo::NormalPacket
            };
            let granule = ((index + 1) * PACKET_FRAMES) as u64;
            writer.write_packet(data, SERIAL, end, granule).unwrap();
        }
        writer.into_inner().into_inner()
    }

    fn offset_of(segment: &[f32], reference: &[f32], around: usize, search: usize) -> isize {
        let error = |start: usize| -> f32 {
            segment
                .iter()
                .zip(&reference[start..])
                .map(|(a, b)| (a - b) * (a - b))
                .sum()
        };
        let best = (around - search..=around + search)
            .step_by(2)
            .min_by(|&a, &b| error(a).total_cmp(&error(b)))
            .unwrap();
        (best as isize - around as isize) / 2
    }

    #[test]
    fn opus_seek_lands_on_the_requested_time() {
        let bytes = opus_stream(6);
        let reference = OpusSource::new(bytes.clone()).unwrap().collect::<Vec<_>>();

        for seconds in [0.0, 0.73, 1.0, 2.37, 4.99] {
            let mut source = OpusSource::new(bytes.clone()).unwrap();
            source.by_ref().take(RATE).for_each(drop);
            source.try_seek(Duration::from_secs_f64(seconds)).unwrap();

            let settle = RATE / 10;
            let segment = source.skip(settle * 2).take(RATE / 10).collect::<Vec<_>>();
            let target = ((seconds * RATE as f64) as usize + settle) * 2;
            let offset = offset_of(&segment, &reference, target, RATE / 10);
            assert!(offset.abs() <= 2, "{seconds}s: off by {offset} frames");
        }
    }

    #[test]
    fn opus_reports_its_decoded_length() {
        let bytes = opus_stream(6);
        let duration = OpusSource::new(bytes.clone()).unwrap().total_duration().unwrap();
        let frames = OpusSource::new(bytes).unwrap().count() / 2;
        let decoded = frames as f64 / RATE as f64;
        assert!((duration.as_secs_f64() - decoded).abs() < 0.001, "{duration:?} vs {decoded}s");
    }

    #[test]
    fn mpeg_audio_is_told_apart_from_containers() {
        let mut tagged = b"ID3\x04\x00\x00\x00\x00\x00\x02".to_vec();
        tagged.extend([0, 0, 0xFF, 0xFB, 0x90]);
        assert!(is_mpeg_audio(&[0xFF, 0xFB, 0x90, 0x00]));
        assert!(is_mpeg_audio(&[0xFF, 0xF1, 0x50, 0x80]));
        assert!(is_mpeg_audio(&tagged));
        assert!(!is_mpeg_audio(b"\x00\x00\x00\x20ftypM4A "));
        assert!(!is_mpeg_audio(b"OggS\x00\x02"));
        assert!(!is_mpeg_audio(b"fLaC\x00\x00"));
    }

    #[test]
    fn opus_seek_past_the_end_fails() {
        let mut source = OpusSource::new(opus_stream(2)).unwrap();
        assert!(source.try_seek(Duration::from_secs(10)).is_err());
    }
}

use std::time::Duration;

const MPEG1_LAYER3_KBPS: [u32; 15] = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MPEG2_LAYER3_KBPS: [u32; 15] = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const MPEG1_SAMPLE_RATES: [u32; 3] = [44_100, 48_000, 32_000];

fn audio_start(bytes: &[u8]) -> usize {
    match bytes.get(..10) {
        Some(tag) if tag.starts_with(b"ID3") => {
            let size = tag[6..10]
                .iter()
                .fold(0usize, |size, &byte| (size << 7) | (byte & 0x7F) as usize);
            let footer = if tag[5] & 0x10 != 0 { 10 } else { 0 };
            10 + size + footer
        }
        _ => 0,
    }
}

pub fn is_mpeg_audio(bytes: &[u8]) -> bool {
    let start = audio_start(bytes);
    matches!(bytes.get(start..start + 2), Some(&[0xFF, sync]) if sync & 0xE0 == 0xE0)
}

struct Frame {
    len: usize,
    samples: u32,
    sample_rate: u32,
}

fn layer3_frame(header: &[u8]) -> Option<Frame> {
    if header[0] != 0xFF || header[1] & 0xE0 != 0xE0 || header[1] & 0x06 != 0x02 {
        return None;
    }
    let version = (header[1] >> 3) & 0x03;
    let bitrate_index = (header[2] >> 4) as usize;
    let rate_index = ((header[2] >> 2) & 0x03) as usize;
    let padding = ((header[2] >> 1) & 0x01) as usize;
    if version == 1 || bitrate_index == 0 || bitrate_index == 15 || rate_index == 3 {
        return None;
    }
    let mpeg1 = version == 3;
    let divisor = match version {
        3 => 1,
        2 => 2,
        _ => 4,
    };
    let sample_rate = MPEG1_SAMPLE_RATES[rate_index] / divisor;
    let kbps = if mpeg1 {
        MPEG1_LAYER3_KBPS[bitrate_index]
    } else {
        MPEG2_LAYER3_KBPS[bitrate_index]
    };
    let samples = if mpeg1 { 1152 } else { 576 };
    let len = (samples / 8 * kbps * 1000 / sample_rate) as usize + padding;
    Some(Frame {
        len,
        samples,
        sample_rate,
    })
}

pub fn duration(bytes: &[u8]) -> Option<Duration> {
    let mut pos = audio_start(bytes);
    let mut seconds = 0.0;
    while let Some(header) = bytes.get(pos..pos + 4) {
        match layer3_frame(header) {
            Some(frame) => {
                seconds += frame.samples as f64 / frame.sample_rate as f64;
                pos += frame.len;
            }
            None => pos += 1,
        }
    }
    (seconds > 0.0).then(|| Duration::from_secs_f64(seconds))
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn frame_scan_counts_the_whole_stream() {
        let mut bytes = b"ID3\x04\x00\x00\x00\x00\x00\x02\x00\x00".to_vec();
        for index in 0..1000 {
            let padded = index % 3 == 0;
            let mut frame = vec![0u8; 417 + padded as usize];
            frame[..4].copy_from_slice(&[0xFF, 0xFB, 0x90 | (padded as u8) << 1, 0x00]);
            bytes.extend(frame);
        }
        bytes.extend(b"TAG");
        let expected = 1000.0 * 1152.0 / 44_100.0;
        let scanned = duration(&bytes).unwrap().as_secs_f64();
        assert!((scanned - expected).abs() < 0.001, "{scanned} vs {expected}");
    }

    #[test]
    fn frame_scan_ignores_non_layer3_streams() {
        assert!(duration(&[0xFF, 0xF1, 0x50, 0x80, 0, 0, 0, 0]).is_none());
        assert!(duration(b"OggS\x00\x02\x00\x00").is_none());
    }
}

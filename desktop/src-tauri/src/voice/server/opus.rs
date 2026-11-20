use std::io::Cursor;

use audiopus::coder::Decoder;
use audiopus::{Channels, SampleRate};
use ogg::{Packet, PacketReader};
use voice_engine::Clip;

use crate::audio::is_ogg_opus;

const RATE: u32 = 24_000;

const GRANULE_RATE: u64 = 48_000;
const MOST_FRAMES: usize = 2_880;
const HEAD: &[u8] = b"OpusHead";

type Packets<'a> = PacketReader<Cursor<&'a [u8]>>;

pub fn clip(bytes: &[u8]) -> Result<Clip, String> {
    if !is_ogg_opus(bytes) {
        return Err("not an ogg opus file".into());
    }
    let mut packets = PacketReader::new(Cursor::new(bytes));
    let head = next(&mut packets)?.ok_or("no opus head")?;
    let pre_skip = pre_skip(&head.data)?;
    next(&mut packets)?;
    let (samples, end) = decoded(&mut packets)?;
    let length = at_rate(end.saturating_sub(pre_skip));
    let samples: Vec<f32> = samples
        .into_iter()
        .skip(at_rate(pre_skip))
        .take(length)
        .collect();
    if samples.is_empty() {
        return Err("the clip has no audio".into());
    }
    Ok(Clip {
        samples,
        rate: RATE,
    })
}

fn decoded(packets: &mut Packets) -> Result<(Vec<f32>, u64), String> {
    let mut decoder = Decoder::new(SampleRate::Hz24000, Channels::Mono).map_err(opus)?;
    let mut frame = vec![0f32; MOST_FRAMES];
    let mut samples = Vec::new();
    let mut end = 0;
    while let Some(packet) = next(packets)? {
        let made = decoder
            .decode_float(Some(&packet.data), &mut frame[..], false)
            .map_err(opus)?;
        samples.extend_from_slice(&frame[..made]);
        end = packet.absgp_page();
    }
    Ok((samples, end))
}

fn next(packets: &mut Packets) -> Result<Option<Packet>, String> {
    packets
        .read_packet()
        .map_err(|error| format!("ogg: {error}"))
}

fn pre_skip(head: &[u8]) -> Result<u64, String> {
    if head.len() < 19 || !head.starts_with(HEAD) || head[18] != 0 {
        return Err("not a plain opus head".into());
    }
    Ok(u16::from_le_bytes([head[10], head[11]]) as u64)
}

fn at_rate(granule: u64) -> usize {
    (granule * RATE as u64 / GRANULE_RATE) as usize
}

fn opus(error: audiopus::Error) -> String {
    format!("opus: {error}")
}

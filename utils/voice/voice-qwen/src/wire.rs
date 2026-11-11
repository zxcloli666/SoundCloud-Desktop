use std::io::{self, Read, Write};

pub const SAY: u8 = b'S';
pub const CANCEL: u8 = b'C';
pub const READY: u8 = b'R';
pub const AUDIO: u8 = b'A';
pub const DONE: u8 = b'D';
pub const FAILED: u8 = b'E';

const HEAD: usize = 9;
const MAX_PAYLOAD: usize = 16 << 20;

pub struct Frame {
    pub kind: u8,
    pub id: u32,
    pub payload: Vec<u8>,
}

pub fn write(out: &mut impl Write, kind: u8, id: u32, payload: &[u8]) -> io::Result<()> {
    let mut head = [0u8; HEAD];
    head[0] = kind;
    head[1..5].copy_from_slice(&id.to_le_bytes());
    head[5..9].copy_from_slice(&(payload.len() as u32).to_le_bytes());
    out.write_all(&head)?;
    out.write_all(payload)?;
    out.flush()
}

pub fn read(input: &mut impl Read) -> io::Result<Frame> {
    let mut head = [0u8; HEAD];
    input.read_exact(&mut head)?;
    let id = u32::from_le_bytes([head[1], head[2], head[3], head[4]]);
    let size = u32::from_le_bytes([head[5], head[6], head[7], head[8]]) as usize;
    if size > MAX_PAYLOAD {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "frame is too large"));
    }
    let mut payload = vec![0u8; size];
    input.read_exact(&mut payload)?;
    Ok(Frame {
        kind: head[0],
        id,
        payload,
    })
}

pub fn samples(payload: &[u8]) -> Vec<f32> {
    payload
        .chunks_exact(4)
        .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_frame_survives_the_pipe() {
        let mut pipe = Vec::new();
        write(&mut pipe, SAY, 7, "1\n300\nloli\nauto\nпривет".as_bytes()).unwrap();
        write(&mut pipe, CANCEL, 7, &[]).unwrap();
        let mut input = pipe.as_slice();
        let say = read(&mut input).unwrap();
        assert_eq!((say.kind, say.id), (SAY, 7));
        assert_eq!(say.payload, "1\n300\nloli\nauto\nпривет".as_bytes());
        let cancel = read(&mut input).unwrap();
        assert_eq!((cancel.kind, cancel.id, cancel.payload.len()), (CANCEL, 7, 0));
        assert!(read(&mut input).is_err());
    }

    #[test]
    fn audio_bytes_become_samples() {
        let bytes: Vec<u8> = [0.5f32, -1.0].iter().flat_map(|s| s.to_le_bytes()).collect();
        assert_eq!(samples(&bytes), vec![0.5, -1.0]);
    }

    #[test]
    fn an_oversized_frame_is_refused() {
        let mut pipe = vec![AUDIO, 1, 0, 0, 0];
        pipe.extend_from_slice(&u32::MAX.to_le_bytes());
        assert!(read(&mut pipe.as_slice()).is_err());
    }
}

const STORED_MAX: usize = 65_535;

pub fn noisy(width: u32, height: u32, seed: u64) -> Vec<u8> {
    let mut state = seed | 1;
    let mut raw = Vec::with_capacity((width as usize * 3 + 1) * height as usize);
    for y in 0..height {
        raw.push(0);
        for x in 0..width {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            let grain = (state & 0x3f) as u32;
            raw.push(((x * 255 / width) + grain).min(255) as u8);
            raw.push(((y * 255 / height) + grain).min(255) as u8);
            raw.push((grain * 3).min(255) as u8);
        }
    }
    let mut header = Vec::new();
    header.extend_from_slice(&width.to_be_bytes());
    header.extend_from_slice(&height.to_be_bytes());
    header.extend_from_slice(&[8, 2, 0, 0, 0]);
    let mut png = b"\x89PNG\r\n\x1a\n".to_vec();
    chunk(&mut png, b"IHDR", &header);
    chunk(&mut png, b"IDAT", &zlib(&raw));
    chunk(&mut png, b"IEND", &[]);
    png
}

fn zlib(raw: &[u8]) -> Vec<u8> {
    let mut out = vec![0x78, 0x01];
    let blocks: Vec<&[u8]> = raw.chunks(STORED_MAX).collect();
    for (at, block) in blocks.iter().enumerate() {
        out.push(u8::from(at + 1 == blocks.len()));
        let len = block.len() as u16;
        out.extend_from_slice(&len.to_le_bytes());
        out.extend_from_slice(&(!len).to_le_bytes());
        out.extend_from_slice(block);
    }
    out.extend_from_slice(&adler32(raw).to_be_bytes());
    out
}

fn chunk(png: &mut Vec<u8>, kind: &[u8; 4], data: &[u8]) {
    png.extend_from_slice(&(data.len() as u32).to_be_bytes());
    let mut covered = kind.to_vec();
    covered.extend_from_slice(data);
    png.extend_from_slice(&covered);
    png.extend_from_slice(&crc32(&covered).to_be_bytes());
}

fn crc32(bytes: &[u8]) -> u32 {
    let table: Vec<u32> = (0..256u32)
        .map(|n| {
            (0..8).fold(n, |c, _| {
                if c & 1 == 1 {
                    0xedb8_8320 ^ (c >> 1)
                } else {
                    c >> 1
                }
            })
        })
        .collect();
    !bytes.iter().fold(u32::MAX, |crc, byte| {
        table[((crc ^ u32::from(*byte)) & 0xff) as usize] ^ (crc >> 8)
    })
}

fn adler32(bytes: &[u8]) -> u32 {
    let (a, b) = bytes.iter().fold((1u32, 0u32), |(a, b), byte| {
        let a = (a + u32::from(*byte)) % 65_521;
        (a, (b + a) % 65_521)
    });
    (b << 16) | a
}

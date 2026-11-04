pub const SIZE: u32 = 32;

const ROWS: usize = 5;
const RADIUS: f32 = 15.5;
const TEXT_WIDTH: u32 = 22;
const CELL_MAX: u32 = 4;
const FILL: [u8; 3] = [229, 57, 53];
const INK: [u8; 3] = [255, 255, 255];

pub fn render(text: &str) -> Vec<u8> {
    let mut pixels = vec![0; (SIZE * SIZE * 4) as usize];
    paint_disc(&mut pixels);
    paint_text(&mut pixels, text);
    pixels
}

fn paint_disc(pixels: &mut [u8]) {
    let center = SIZE as f32 / 2.0;
    for y in 0..SIZE {
        for x in 0..SIZE {
            let dx = x as f32 + 0.5 - center;
            let dy = y as f32 + 0.5 - center;
            let coverage = (RADIUS - (dx * dx + dy * dy).sqrt() + 0.5).clamp(0.0, 1.0);
            put(pixels, x, y, FILL, (coverage * 255.0).round() as u8);
        }
    }
}

fn paint_text(pixels: &mut [u8], text: &str) {
    let glyphs = text.chars().map(pattern).collect::<Vec<_>>();
    let gaps = glyphs.len().saturating_sub(1) as u32;
    let units = glyphs.iter().map(width).sum::<u32>() + gaps;
    if units == 0 {
        return;
    }
    let cell = (TEXT_WIDTH / units).clamp(1, CELL_MAX);
    let top = SIZE.saturating_sub(ROWS as u32 * cell) / 2;
    let mut left = SIZE.saturating_sub(units * cell) / 2;
    for glyph in &glyphs {
        for (row, line) in glyph.iter().enumerate() {
            for (column, _) in line.bytes().enumerate().filter(|(_, bit)| *bit == b'#') {
                let x = left + column as u32 * cell;
                let y = top + row as u32 * cell;
                paint_cell(pixels, x, y, cell);
            }
        }
        left += (width(glyph) + 1) * cell;
    }
}

fn paint_cell(pixels: &mut [u8], x: u32, y: u32, cell: u32) {
    for dy in 0..cell {
        for dx in 0..cell {
            put(pixels, x + dx, y + dy, INK, 255);
        }
    }
}

fn put(pixels: &mut [u8], x: u32, y: u32, color: [u8; 3], alpha: u8) {
    if x >= SIZE || y >= SIZE {
        return;
    }
    let at = ((y * SIZE + x) * 4) as usize;
    pixels[at..at + 3].copy_from_slice(&color);
    pixels[at + 3] = alpha;
}

fn width(glyph: &[&str; ROWS]) -> u32 {
    glyph[0].len() as u32
}

fn pattern(ch: char) -> [&'static str; ROWS] {
    match ch {
        '0' => ["###", "#.#", "#.#", "#.#", "###"],
        '1' => [".#.", "##.", ".#.", ".#.", "###"],
        '2' => ["###", "..#", "###", "#..", "###"],
        '3' => ["###", "..#", "###", "..#", "###"],
        '4' => ["#.#", "#.#", "###", "..#", "..#"],
        '5' => ["###", "#..", "###", "..#", "###"],
        '6' => ["###", "#..", "###", "#.#", "###"],
        '7' => ["###", "..#", "..#", ".#.", ".#."],
        '8' => ["###", "#.#", "###", "#.#", "###"],
        '9' => ["###", "#.#", "###", "..#", "###"],
        '+' => ["...", ".#.", "###", ".#.", "..."],
        '@' => [".###.", "#...#", "#.###", "#.##.", ".####"],
        _ => ["...", "...", "...", "...", "..."],
    }
}

const SAMPLES: u32 = 4;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Glyph {
    Previous,
    Play,
    Pause,
    Next,
}

pub fn render(glyph: Glyph, size: u32, ink: u8) -> Vec<u8> {
    (0..size * size)
        .flat_map(|at| [ink, ink, ink, alpha(glyph, size, at % size, at / size)])
        .collect()
}

fn alpha(glyph: Glyph, size: u32, x: u32, y: u32) -> u8 {
    let side = (size * SAMPLES) as f32;
    let hits = (0..SAMPLES * SAMPLES)
        .filter(|sample| {
            let left = (x * SAMPLES + sample % SAMPLES) as f32 + 0.5;
            let top = (y * SAMPLES + sample / SAMPLES) as f32 + 0.5;
            glyph.covers(left / side, top / side)
        })
        .count() as u32;
    (hits * 255 / (SAMPLES * SAMPLES)) as u8
}

impl Glyph {
    fn covers(self, x: f32, y: f32) -> bool {
        match self {
            Self::Previous => skip(1.0 - x, y),
            Self::Play => triangle(x, y, 0.25, 0.85, 0.36),
            Self::Pause => bar(x, y, 0.25, 0.41) || bar(x, y, 0.59, 0.75),
            Self::Next => skip(x, y),
        }
    }
}

fn skip(x: f32, y: f32) -> bool {
    triangle(x, y, 0.19, 0.69, 0.32) || bar(x, y, 0.69, 0.81)
}

fn triangle(x: f32, y: f32, left: f32, right: f32, half: f32) -> bool {
    (left..right).contains(&x) && (y - 0.5).abs() <= half * (right - x) / (right - left)
}

fn bar(x: f32, y: f32, left: f32, right: f32) -> bool {
    (left..right).contains(&x) && (0.18..0.82).contains(&y)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(glyph: Glyph, size: u32, y: u32) -> Vec<u8> {
        (0..size).map(|x| alpha(glyph, size, x, y)).collect()
    }

    #[test]
    fn pixels_hold_the_ink_and_the_coverage() {
        let pixels = render(Glyph::Pause, 16, 32);
        assert_eq!(pixels.len(), 16 * 16 * 4);
        assert!(pixels.chunks(4).all(|pixel| pixel[..3] == [32, 32, 32]));
        assert!(pixels.chunks(4).any(|pixel| pixel[3] == 255));
        assert_eq!(pixels[3], 0);
    }

    #[test]
    fn previous_mirrors_next() {
        for y in 0..20 {
            let mut mirrored = row(Glyph::Next, 20, y);
            mirrored.reverse();
            assert_eq!(row(Glyph::Previous, 20, y), mirrored);
        }
    }

    #[test]
    fn pause_has_a_gap_and_play_is_solid() {
        let pause = row(Glyph::Pause, 16, 8);
        assert_eq!((pause[5], pause[8], pause[10]), (255, 0, 255));
        let play = row(Glyph::Play, 16, 8);
        assert_eq!((play[2], play[5], play[8], play[10]), (0, 255, 255, 255));
    }

    #[test]
    fn every_glyph_is_symmetric_top_to_bottom() {
        for glyph in [Glyph::Previous, Glyph::Play, Glyph::Pause, Glyph::Next] {
            for y in 0..8 {
                assert_eq!(row(glyph, 16, y), row(glyph, 16, 15 - y));
            }
        }
    }
}

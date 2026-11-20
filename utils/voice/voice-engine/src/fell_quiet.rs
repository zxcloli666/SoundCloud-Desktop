use std::collections::VecDeque;

const WINDOW: usize = 320;
const SMOOTHED_OVER: usize = 10;
const REMEMBERED: usize = 200;
const SETTLED_AFTER: usize = 25;
const QUIET_FOR: usize = 50;
const SPOKEN_SHARE: f32 = 0.9;
const DROP: f32 = 0.355;

#[derive(Default)]
pub struct Loudness {
    rest: Vec<f32>,
    levels: VecDeque<f32>,
    quiet: usize,
    windows: usize,
}

impl Loudness {
    pub fn push(&mut self, samples: &[f32]) -> Option<usize> {
        let mut rest = std::mem::take(&mut self.rest);
        rest.extend_from_slice(samples);
        let whole = rest.len() / WINDOW * WINDOW;
        let mut fell = None;
        for window in rest[..whole].chunks(WINDOW) {
            fell = fell.or(self.heard(window));
        }
        rest.drain(..whole);
        self.rest = rest;
        fell
    }

    fn heard(&mut self, window: &[f32]) -> Option<usize> {
        let level = (window.iter().map(|s| s * s).sum::<f32>() / WINDOW as f32).sqrt();
        self.windows += 1;
        if self.levels.len() == REMEMBERED {
            self.levels.pop_front();
        }
        self.levels.push_back(level);
        if self.levels.len() < SETTLED_AFTER {
            return None;
        }
        let lately = self.levels.iter().rev().take(SMOOTHED_OVER);
        let now = lately.sum::<f32>() / SMOOTHED_OVER as f32;
        if now >= self.spoken() * DROP {
            self.quiet = 0;
            return None;
        }
        self.quiet += 1;
        (self.quiet == QUIET_FOR).then(|| (self.windows - QUIET_FOR) * WINDOW)
    }

    fn spoken(&self) -> f32 {
        let mut levels: Vec<f32> = self.levels.iter().copied().collect();
        let at = ((levels.len() as f32 * SPOKEN_SHARE) as usize).min(levels.len() - 1);
        *levels.select_nth_unstable_by(at, f32::total_cmp).1
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: usize = 16_000;

    struct Sound(u32);

    impl Sound {
        fn hiss(&mut self) -> f32 {
            self.0 = self.0.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            (self.0 >> 8) as f32 / 8_388_608.0 - 1.0
        }

        fn room(&mut self, seconds: f32, level: f32) -> Vec<f32> {
            (0..(seconds * RATE as f32) as usize)
                .map(|_| self.hiss() * level)
                .collect()
        }

        fn voice(&mut self, seconds: f32, level: f32, room: f32) -> Vec<f32> {
            (0..(seconds * RATE as f32) as usize)
                .map(|at| {
                    let syllable = at % (RATE / 5) < RATE * 3 / 20;
                    self.hiss() * if syllable { level } else { room }
                })
                .collect()
        }
    }

    fn fell_at(heard: &[f32]) -> Option<f32> {
        let mut loudness = Loudness::default();
        heard
            .chunks(1600)
            .find_map(|chunk| loudness.push(chunk))
            .map(|at| at as f32 / RATE as f32)
    }

    #[test]
    fn a_voice_that_stops_among_talk_is_missed_a_second_later() {
        let mut sound = Sound(7);
        let mut heard = sound.room(0.5, 0.03);
        heard.extend(sound.voice(1.5, 0.3, 0.03));
        let spoken_for = heard.len();
        heard.extend(sound.room(0.9, 0.03));
        assert_eq!(fell_at(&heard), None);
        heard.extend(sound.room(0.5, 0.03));
        let at = fell_at(&heard).unwrap();
        assert!((at - spoken_for as f32 / RATE as f32).abs() < 0.3, "{at}");
    }

    #[test]
    fn talk_that_never_gets_quieter_ends_nothing() {
        assert_eq!(fell_at(&Sound(7).room(8.0, 0.05)), None);
    }

    #[test]
    fn a_pause_between_words_is_not_the_end() {
        let mut sound = Sound(7);
        let mut heard = sound.voice(1.0, 0.3, 0.03);
        heard.extend(sound.room(0.6, 0.03));
        heard.extend(sound.voice(1.0, 0.3, 0.03));
        assert_eq!(fell_at(&heard), None);
        heard.extend(sound.room(2.0, 0.03));
        assert!(fell_at(&heard).unwrap() > 2.5);
    }

    #[test]
    fn a_room_almost_as_loud_as_the_voice_ends_nothing() {
        let mut sound = Sound(7);
        let mut heard = sound.voice(1.5, 0.1, 0.06);
        heard.extend(sound.room(4.0, 0.06));
        assert_eq!(fell_at(&heard), None);
    }
}

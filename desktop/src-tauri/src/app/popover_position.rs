use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

const FILE: &str = "mini_player.json";
const PLACEMENT_TOLERANCE: i32 = 2;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Point {
    pub x: i32,
    pub y: i32,
}

#[derive(Clone, Copy, Debug)]
pub struct Screen {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub scale: f64,
}

#[derive(Default)]
struct Slots {
    placed: Option<Point>,
    chosen: Option<Point>,
    dirty: bool,
}

#[derive(Default)]
pub struct PositionMemory {
    path: Option<PathBuf>,
    slots: Mutex<Slots>,
}

impl PositionMemory {
    pub fn load(data_dir: &Path) -> Self {
        let path = data_dir.join(FILE);
        let chosen = std::fs::read(&path)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<Point>(&bytes).ok());
        Self {
            path: Some(path),
            slots: Mutex::new(Slots {
                chosen,
                ..Slots::default()
            }),
        }
    }

    pub fn chosen(&self) -> Option<Point> {
        self.slots.lock().ok().and_then(|s| s.chosen)
    }

    pub fn mark_placed(&self, point: Point) {
        if let Ok(mut s) = self.slots.lock() {
            s.placed = Some(point);
        }
    }

    pub fn record_move(&self, point: Point) {
        let Ok(mut s) = self.slots.lock() else {
            return;
        };
        if s.placed.is_some_and(|placed| near(placed, point)) || s.chosen == Some(point) {
            return;
        }
        s.chosen = Some(point);
        s.placed = Some(point);
        s.dirty = true;
    }

    pub fn persist(&self) {
        let Some(path) = &self.path else {
            return;
        };
        let point = {
            let Ok(mut s) = self.slots.lock() else {
                return;
            };
            if !s.dirty {
                return;
            }
            s.dirty = false;
            s.chosen
        };
        let Some(point) = point else {
            return;
        };
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(bytes) = serde_json::to_vec(&point) {
            let _ = std::fs::write(path, bytes);
        }
    }
}

fn near(a: Point, b: Point) -> bool {
    (a.x - b.x).abs() <= PLACEMENT_TOLERANCE && (a.y - b.y).abs() <= PLACEMENT_TOLERANCE
}

pub fn fit(point: Point, size: (f64, f64), screens: &[Screen]) -> Option<Point> {
    screens.iter().find_map(|screen| {
        let (w, h) = (size.0 * screen.scale, size.1 * screen.scale);
        let cx = point.x as f64 + w / 2.0;
        let cy = point.y as f64 + h / 2.0;
        let inside = cx >= screen.x
            && cx < screen.x + screen.width
            && cy >= screen.y
            && cy < screen.y + screen.height;
        inside.then(|| Point {
            x: clamp(point.x as f64, screen.x, screen.x + screen.width - w) as i32,
            y: clamp(point.y as f64, screen.y, screen.y + screen.height - h) as i32,
        })
    })
}

fn clamp(value: f64, min: f64, max: f64) -> f64 {
    value.min(max).max(min)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SIZE: (f64, f64) = (384.0, 248.0);

    fn screen(x: f64, y: f64, width: f64, height: f64, scale: f64) -> Screen {
        Screen {
            x,
            y,
            width,
            height,
            scale,
        }
    }

    #[test]
    fn keeps_a_point_that_fits() {
        let screens = [screen(0.0, 0.0, 1920.0, 1080.0, 1.0)];
        let p = Point { x: 400, y: 300 };
        assert_eq!(fit(p, SIZE, &screens), Some(p));
    }

    #[test]
    fn pulls_a_half_visible_window_back_on_screen() {
        let screens = [screen(0.0, 0.0, 1920.0, 1080.0, 1.0)];
        let p = Point { x: 1700, y: 900 };
        assert_eq!(fit(p, SIZE, &screens), Some(Point { x: 1536, y: 832 }));
    }

    #[test]
    fn drops_a_point_from_a_detached_monitor() {
        let screens = [screen(0.0, 0.0, 1920.0, 1080.0, 1.0)];
        assert_eq!(fit(Point { x: 2500, y: 300 }, SIZE, &screens), None);
    }

    #[test]
    fn uses_the_scale_of_the_monitor_it_lands_on() {
        let screens = [
            screen(0.0, 0.0, 1920.0, 1080.0, 1.0),
            screen(1920.0, 0.0, 3840.0, 2160.0, 2.0),
        ];
        let p = Point { x: 5200, y: 1800 };
        assert_eq!(fit(p, SIZE, &screens), Some(Point { x: 4992, y: 1664 }));
    }

    #[test]
    fn ignores_its_own_placement_and_keeps_user_moves() {
        let memory = PositionMemory::default();
        memory.mark_placed(Point { x: 100, y: 100 });
        memory.record_move(Point { x: 101, y: 100 });
        assert_eq!(memory.chosen(), None);
        memory.record_move(Point { x: 640, y: 200 });
        assert_eq!(memory.chosen(), Some(Point { x: 640, y: 200 }));
    }
}

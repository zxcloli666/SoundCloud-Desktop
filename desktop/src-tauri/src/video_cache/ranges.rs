use std::ops::Range;

#[derive(Default)]
pub struct Ranges(Vec<Range<u64>>);

impl Ranges {
    pub fn add(&mut self, new: Range<u64>) {
        if new.is_empty() {
            return;
        }
        let mut merged = new;
        self.0.retain(|have| {
            let apart = have.end < merged.start || merged.end < have.start;
            if !apart {
                merged = merged.start.min(have.start)..merged.end.max(have.end);
            }
            apart
        });
        self.0.push(merged);
        self.0.sort_by_key(|have| have.start);
    }

    pub fn run_end(&self, at: u64) -> Option<u64> {
        self.0
            .iter()
            .find(|have| have.contains(&at))
            .map(|have| have.end)
    }

    pub fn gap(&self, from: u64, total: u64) -> Option<Range<u64>> {
        let start = self.run_end(from).unwrap_or(from);
        if start >= total {
            return None;
        }
        let end = self
            .0
            .iter()
            .map(|have| have.start)
            .find(|have| *have > start)
            .unwrap_or(total);
        Some(start..end)
    }
}

#[cfg(test)]
mod tests {
    use super::Ranges;

    fn of(parts: &[std::ops::Range<u64>]) -> Ranges {
        let mut ranges = Ranges::default();
        for part in parts {
            ranges.add(part.clone());
        }
        ranges
    }

    #[test]
    fn touching_parts_become_one_run() {
        let ranges = of(&[0..10, 20..30, 10..20]);
        assert_eq!(ranges.run_end(0), Some(30));
        assert_eq!(ranges.run_end(29), Some(30));
        assert_eq!(ranges.run_end(30), None);
    }

    #[test]
    fn a_gap_starts_after_the_run_and_ends_at_the_next_one() {
        let ranges = of(&[0..10, 40..50]);
        assert_eq!(ranges.gap(0, 100), Some(10..40));
        assert_eq!(ranges.gap(25, 100), Some(25..40));
        assert_eq!(ranges.gap(45, 100), Some(50..100));
        assert_eq!(ranges.gap(45, 50), None);
    }

    #[test]
    fn a_wide_part_swallows_the_small_ones() {
        let ranges = of(&[5..6, 8..9, 0..20]);
        assert_eq!(ranges.gap(0, 20), None);
    }
}

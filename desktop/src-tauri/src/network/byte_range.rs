#[derive(Debug, PartialEq, Eq)]
pub enum Span {
    Whole,
    Part { start: u64, end: u64 },
    Unsatisfiable,
}

pub fn parse(header: Option<&str>, len: u64) -> Span {
    let Some(spec) = header.and_then(|value| value.trim().strip_prefix("bytes=")) else {
        return Span::Whole;
    };
    if spec.contains(',') {
        return Span::Whole;
    }
    let Some((from, to)) = spec.trim().split_once('-') else {
        return Span::Whole;
    };
    let (from, to) = (from.trim(), to.trim());
    if from.is_empty() {
        return suffix(to, len);
    }
    let Ok(start) = from.parse::<u64>() else {
        return Span::Whole;
    };
    let end = if to.is_empty() {
        len.saturating_sub(1)
    } else {
        match to.parse::<u64>() {
            Ok(end) if end >= start => end.min(len.saturating_sub(1)),
            _ => return Span::Whole,
        }
    };
    if start >= len {
        return Span::Unsatisfiable;
    }
    Span::Part { start, end }
}

fn suffix(count: &str, len: u64) -> Span {
    match count.parse::<u64>() {
        Ok(0) => Span::Unsatisfiable,
        Ok(_) if len == 0 => Span::Unsatisfiable,
        Ok(count) => Span::Part {
            start: len.saturating_sub(count),
            end: len - 1,
        },
        Err(_) => Span::Whole,
    }
}

#[cfg(test)]
mod tests {
    use super::{Span, parse};

    #[test]
    fn no_header_is_the_whole_file() {
        assert_eq!(parse(None, 100), Span::Whole);
    }

    #[test]
    fn an_open_range_runs_to_the_end() {
        assert_eq!(parse(Some("bytes=10-"), 100), Span::Part { start: 10, end: 99 });
        assert_eq!(parse(Some("bytes=0-"), 100), Span::Part { start: 0, end: 99 });
    }

    #[test]
    fn a_closed_range_is_clamped_to_the_file() {
        assert_eq!(parse(Some("bytes=10-19"), 100), Span::Part { start: 10, end: 19 });
        assert_eq!(parse(Some("bytes=90-500"), 100), Span::Part { start: 90, end: 99 });
    }

    #[test]
    fn a_suffix_takes_the_tail() {
        assert_eq!(parse(Some("bytes=-30"), 100), Span::Part { start: 70, end: 99 });
        assert_eq!(parse(Some("bytes=-500"), 100), Span::Part { start: 0, end: 99 });
        assert_eq!(parse(Some("bytes=-0"), 100), Span::Unsatisfiable);
    }

    #[test]
    fn a_start_past_the_end_is_416() {
        assert_eq!(parse(Some("bytes=100-"), 100), Span::Unsatisfiable);
        assert_eq!(parse(Some("bytes=150-200"), 100), Span::Unsatisfiable);
        assert_eq!(parse(Some("bytes=0-"), 0), Span::Unsatisfiable);
        assert_eq!(parse(Some("bytes=-5"), 0), Span::Unsatisfiable);
    }

    #[test]
    fn a_broken_header_is_ignored() {
        assert_eq!(parse(Some("bytes=abc"), 100), Span::Whole);
        assert_eq!(parse(Some("bytes=20-10"), 100), Span::Whole);
        assert_eq!(parse(Some("items=0-1"), 100), Span::Whole);
        assert_eq!(parse(Some("bytes=0-1,5-6"), 100), Span::Whole);
    }
}

const LONGEST_LINE: usize = 256 << 10;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Frame {
    pub event: String,
    pub data: String,
}

#[derive(Default)]
pub struct Parser {
    line: Vec<u8>,
    after_return: bool,
    overlong: bool,
    event: String,
    data: Vec<String>,
}

impl Parser {
    pub fn push(&mut self, bytes: &[u8]) -> Vec<Frame> {
        let mut frames = Vec::new();
        for byte in bytes {
            let feed = *byte == b'\n' && self.after_return;
            self.after_return = *byte == b'\r';
            match byte {
                b'\n' if feed => {}
                b'\n' | b'\r' => frames.extend(self.end_line()),
                _ if self.line.len() == LONGEST_LINE => self.overlong = true,
                _ => self.line.push(*byte),
            }
        }
        frames
    }

    fn end_line(&mut self) -> Option<Frame> {
        let line = std::mem::take(&mut self.line);
        if std::mem::take(&mut self.overlong) {
            return None;
        }
        let line = String::from_utf8_lossy(&line);
        let line = line.strip_prefix('\u{feff}').unwrap_or(&line);
        if line.is_empty() {
            return self.dispatch();
        }
        let (field, value) = line.split_once(':').unwrap_or((line, ""));
        let value = value.strip_prefix(' ').unwrap_or(value);
        match field {
            "event" => self.event = value.to_string(),
            "data" => self.data.push(value.to_string()),
            _ => {}
        }
        None
    }

    fn dispatch(&mut self) -> Option<Frame> {
        let event = std::mem::take(&mut self.event);
        let data = std::mem::take(&mut self.data);
        if data.is_empty() {
            return None;
        }
        Some(Frame {
            event: if event.is_empty() {
                "message".into()
            } else {
                event
            },
            data: data.join("\n"),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(event: &str, data: &str) -> Frame {
        Frame {
            event: event.into(),
            data: data.into(),
        }
    }

    fn parsed(chunks: &[&[u8]]) -> Vec<Frame> {
        let mut parser = Parser::default();
        chunks.iter().flat_map(|chunk| parser.push(chunk)).collect()
    }

    #[test]
    fn events_come_out_when_their_blank_line_arrives() {
        let mut parser = Parser::default();
        assert!(
            parser
                .push(b"event: say\ndata: {\"text\":\"Hi\"}\n")
                .is_empty()
        );
        assert_eq!(parser.push(b"\n"), [frame("say", "{\"text\":\"Hi\"}")]);
        assert_eq!(
            parser.push(b"event: done\ndata: {}\n\nevent: say\n"),
            [frame("done", "{}")]
        );
    }

    #[test]
    fn a_stream_cut_anywhere_parses_the_same() {
        let stream = "event: action\r\ndata: {\"name\":\"volume_set\",\"args\":{\"level\":40}}\r\n\r\n\
                      : keepalive\n\nevent: say\ndata: {\"text\":\"Сделала потише 🎵\"}\n\n\
                      event: done\rdata: {}\r\r";
        let whole = parsed(&[stream.as_bytes()]);
        assert_eq!(
            whole,
            [
                frame(
                    "action",
                    "{\"name\":\"volume_set\",\"args\":{\"level\":40}}"
                ),
                frame("say", "{\"text\":\"Сделала потише 🎵\"}"),
                frame("done", "{}"),
            ]
        );
        for size in [1, 2, 3, 5, 7, 16] {
            let chunks: Vec<&[u8]> = stream.as_bytes().chunks(size).collect();
            assert_eq!(parsed(&chunks), whole, "by {size}");
        }
    }

    #[test]
    fn comments_and_unknown_fields_are_skipped() {
        let frames = parsed(&[b": ping\nid: 7\nretry: 100\nevent: say\ndata: x\n\n: ping\n\n"]);
        assert_eq!(frames, [frame("say", "x")]);
    }

    #[test]
    fn data_lines_join_and_a_missing_event_is_a_message() {
        let frames = parsed(&[b"data: one\ndata:two\ndata\n\n"]);
        assert_eq!(frames, [frame("message", "one\ntwo\n")]);
    }

    #[test]
    fn an_event_without_data_is_dropped() {
        assert!(parsed(&[b"event: done\n\n"]).is_empty());
        assert_eq!(
            parsed(&[b"event: done\n\ndata: {}\n\n"]),
            [frame("message", "{}")]
        );
    }

    #[test]
    fn a_mark_at_the_start_and_one_space_after_the_colon_are_dropped() {
        let frames = parsed(&["\u{feff}event: say\ndata:  two spaces\n\n".as_bytes()]);
        assert_eq!(frames, [frame("say", " two spaces")]);
    }

    #[test]
    fn an_endless_line_is_dropped_without_growing() {
        let mut parser = Parser::default();
        assert!(parser.push(b"data: ").is_empty());
        for _ in 0..(LONGEST_LINE / 1024 + 2) {
            assert!(parser.push(&[b'x'; 1024]).is_empty());
        }
        assert!(parser.line.len() <= LONGEST_LINE);
        assert_eq!(
            parser.push(b"\n\nevent: say\ndata: ok\n\n"),
            [frame("say", "ok")]
        );
    }
}

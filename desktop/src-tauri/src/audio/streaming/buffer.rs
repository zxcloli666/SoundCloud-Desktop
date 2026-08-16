use std::io::{self, Read, Seek, SeekFrom};
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

pub(super) const MIN_VALID_BYTES: usize = 8 * 1024;

struct BufferState {
    bytes: Vec<u8>,
    complete: bool,
    error: Option<String>,
}

#[derive(Clone)]
pub(super) struct StreamingBuffer {
    inner: Arc<(Mutex<BufferState>, Condvar)>,
}

pub struct StreamingReader {
    shared: StreamingBuffer,
    position: usize,
}

impl StreamingBuffer {
    pub(super) fn new() -> Self {
        Self {
            inner: Arc::new((
                Mutex::new(BufferState {
                    bytes: Vec::with_capacity(512 * 1024),
                    complete: false,
                    error: None,
                }),
                Condvar::new(),
            )),
        }
    }

    pub(super) fn push(&self, chunk: &[u8]) {
        let (lock, ready) = &*self.inner;
        let mut state = lock.lock().unwrap();
        state.bytes.extend_from_slice(chunk);
        ready.notify_all();
    }

    pub(super) fn finish(&self) {
        let (lock, ready) = &*self.inner;
        let mut state = lock.lock().unwrap();
        state.complete = true;
        ready.notify_all();
    }

    pub(super) fn fail(&self, error: String) {
        let (lock, ready) = &*self.inner;
        let mut state = lock.lock().unwrap();
        state.error = Some(error);
        state.complete = true;
        ready.notify_all();
    }

    pub(super) fn status(&self) -> (usize, bool, Option<String>) {
        let (lock, _) = &*self.inner;
        let state = lock.lock().unwrap();
        (state.bytes.len(), state.complete, state.error.clone())
    }

    pub(super) fn snapshot(&self) -> Vec<u8> {
        let (lock, _) = &*self.inner;
        lock.lock().unwrap().bytes.clone()
    }

    pub(super) fn reader(&self) -> StreamingReader {
        StreamingReader {
            shared: self.clone(),
            position: 0,
        }
    }
}

impl Read for StreamingReader {
    fn read(&mut self, output: &mut [u8]) -> io::Result<usize> {
        let (lock, ready) = &*self.shared.inner;
        loop {
            let state = lock.lock().unwrap();
            let available = state.bytes.len().saturating_sub(self.position);
            if available > 0 {
                let count = output.len().min(available);
                output[..count]
                    .copy_from_slice(&state.bytes[self.position..self.position + count]);
                self.position += count;
                return Ok(count);
            }
            if let Some(error) = state.error.as_ref() {
                return Err(io::Error::new(io::ErrorKind::UnexpectedEof, error.clone()));
            }
            if state.complete {
                return Ok(0);
            }
            drop(ready.wait_timeout(state, Duration::from_millis(200)).unwrap());
        }
    }
}

impl Seek for StreamingReader {
    fn seek(&mut self, target: SeekFrom) -> io::Result<u64> {
        let (lock, _) = &*self.shared.inner;
        let state = lock.lock().unwrap();
        let length = state.bytes.len() as i128;
        let current = self.position as i128;
        let next = match target {
            SeekFrom::Start(position) => position as i128,
            SeekFrom::Current(offset) => current + offset as i128,
            SeekFrom::End(offset) if state.complete => length + offset as i128,
            SeekFrom::End(_) => {
                return Err(io::Error::new(
                    io::ErrorKind::Unsupported,
                    "stream length is not known yet",
                ));
            }
        };
        if next < 0 || next > length {
            return Err(io::Error::new(
                io::ErrorKind::Unsupported,
                "position is outside the buffered stream",
            ));
        }
        self.position = next as usize;
        Ok(self.position as u64)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn growing_reader_unblocks_when_bytes_arrive() {
        let buffer = StreamingBuffer::new();
        let writer = buffer.clone();
        let handle = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(20));
            writer.push(b"hello");
            writer.finish();
        });
        let mut reader = buffer.reader();
        let mut output = [0u8; 5];
        reader.read_exact(&mut output).unwrap();
        handle.join().unwrap();
        assert_eq!(&output, b"hello");
    }

    #[test]
    fn growing_reader_rejects_unbuffered_seek() {
        let buffer = StreamingBuffer::new();
        buffer.push(b"abc");
        let mut reader = buffer.reader();
        assert!(reader.seek(SeekFrom::Start(8)).is_err());
    }

    #[test]
    fn growing_reader_can_rewind_inside_buffered_bytes() {
        let buffer = StreamingBuffer::new();
        buffer.push(b"abcdef");
        let mut reader = buffer.reader();
        let mut first = [0u8; 4];
        reader.read_exact(&mut first).unwrap();
        assert_eq!(&first, b"abcd");

        reader.seek(SeekFrom::Start(1)).unwrap();
        let mut replayed = [0u8; 2];
        reader.read_exact(&mut replayed).unwrap();
        assert_eq!(&replayed, b"bc");
    }
}

#![allow(dead_code)]

use std::collections::{HashMap, VecDeque};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use sha2::{Digest, Sha256};
use voice_models::{Fetch, FetchError, File, Kind, Manifest, Model, Options, Response};

pub struct Server {
    pub base: String,
    pub files: HashMap<String, Vec<u8>>,
    state: Arc<State>,
}

#[derive(Default)]
struct State {
    files: HashMap<String, Vec<u8>>,
    cuts: Mutex<VecDeque<usize>>,
    cut_always: Mutex<Option<usize>>,
    corrupt: Mutex<HashMap<String, u32>>,
    log: Mutex<Vec<(String, u64)>>,
}

impl Server {
    pub fn start(files: HashMap<String, Vec<u8>>) -> Server {
        let state = Arc::new(State {
            files: files.clone(),
            ..State::default()
        });
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let shared = state.clone();
        thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let state = shared.clone();
                thread::spawn(move || handle(stream, &state));
            }
        });
        Server { base, files, state }
    }

    pub fn cut_next(&self, body_bytes: usize) {
        self.state.cuts.lock().unwrap().push_back(body_bytes);
    }

    pub fn cut_always(&self, body_bytes: usize) {
        *self.state.cut_always.lock().unwrap() = Some(body_bytes);
    }

    pub fn corrupt_next(&self, path: &str, times: u32) {
        self.state
            .corrupt
            .lock()
            .unwrap()
            .insert(path.to_string(), times);
    }

    pub fn requests(&self) -> Vec<(String, u64)> {
        self.state.log.lock().unwrap().clone()
    }
}

fn handle(mut stream: TcpStream, state: &State) {
    let mut reader = BufReader::new(stream.try_clone().unwrap());
    let mut first = String::new();
    reader.read_line(&mut first).unwrap();
    let path = first.split_whitespace().nth(1).unwrap_or("/").to_string();
    let mut start = 0u64;
    loop {
        let mut line = String::new();
        reader.read_line(&mut line).unwrap();
        if line.trim().is_empty() {
            break;
        }
        if let Some(range) = line.to_ascii_lowercase().strip_prefix("range: bytes=") {
            start = range.trim().trim_end_matches('-').parse().unwrap();
        }
    }
    state.log.lock().unwrap().push((path.clone(), start));
    let Some(data) = state.files.get(&path) else {
        let _ = stream
            .write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
        return;
    };
    let mut body = data[start as usize..].to_vec();
    {
        let mut corrupt = state.corrupt.lock().unwrap();
        if let Some(left) = corrupt.get_mut(&path)
            && *left > 0
            && !body.is_empty()
        {
            *left -= 1;
            body[0] ^= 0xff;
        }
    }
    let total = data.len();
    let head = if start > 0 {
        format!(
            "HTTP/1.1 206 Partial Content\r\nContent-Range: bytes {start}-{}/{total}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            total - 1,
            body.len()
        )
    } else {
        format!(
            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            body.len()
        )
    };
    let cut = state
        .cuts
        .lock()
        .unwrap()
        .pop_front()
        .or(*state.cut_always.lock().unwrap());
    let _ = stream.write_all(head.as_bytes());
    let end = cut.map(|c| c.min(body.len())).unwrap_or(body.len());
    let _ = stream.write_all(&body[..end]);
    let _ = stream.flush();
    let _ = stream.shutdown(Shutdown::Both);
}

pub struct HttpFetch;

impl Fetch for HttpFetch {
    fn get(&self, url: &str, offset: u64) -> Result<Response, FetchError> {
        let rest = url.strip_prefix("http://").unwrap();
        let (host, path) = rest.split_once('/').unwrap();
        let mut stream =
            TcpStream::connect(host).map_err(|e| FetchError::Network(e.to_string()))?;
        stream
            .set_read_timeout(Some(Duration::from_secs(10)))
            .unwrap();
        let range = if offset > 0 {
            format!("Range: bytes={offset}-\r\n")
        } else {
            String::new()
        };
        let request =
            format!("GET /{path} HTTP/1.1\r\nHost: {host}\r\n{range}Connection: close\r\n\r\n");
        stream
            .write_all(request.as_bytes())
            .map_err(|e| FetchError::Network(e.to_string()))?;
        let mut reader = BufReader::new(stream);
        let mut status_line = String::new();
        reader
            .read_line(&mut status_line)
            .map_err(|e| FetchError::Network(e.to_string()))?;
        let status: u16 = status_line
            .split_whitespace()
            .nth(1)
            .unwrap()
            .parse()
            .unwrap();
        let mut length = 0u64;
        let mut range_total = None;
        loop {
            let mut line = String::new();
            reader
                .read_line(&mut line)
                .map_err(|e| FetchError::Network(e.to_string()))?;
            if line.trim().is_empty() {
                break;
            }
            let lower = line.to_ascii_lowercase();
            if let Some(v) = lower.strip_prefix("content-length:") {
                length = v.trim().parse().unwrap();
            }
            if let Some(v) = lower.strip_prefix("content-range:") {
                range_total = Some(v.rsplit('/').next().unwrap().trim().parse::<u64>().unwrap());
            }
        }
        match status {
            200 => Ok(Response {
                start: 0,
                total: length,
                body: Box::new(reader),
            }),
            206 => Ok(Response {
                start: offset,
                total: range_total.unwrap(),
                body: Box::new(reader),
            }),
            code => Err(FetchError::Status(code)),
        }
    }
}

pub fn data(seed: u64, len: usize) -> Vec<u8> {
    let mut x = seed.wrapping_mul(0x9E3779B97F4A7C15) | 1;
    (0..len)
        .map(|_| {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            (x >> 24) as u8
        })
        .collect()
}

pub fn sha(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

pub struct Fixture {
    pub server: Server,
    pub manifest: Manifest,
    pub root: PathBuf,
}

pub fn fixture(name: &str, sizes: &[usize]) -> Fixture {
    let id = "m1";
    let mut served = HashMap::new();
    let mut files = Vec::new();
    for (i, size) in sizes.iter().enumerate() {
        let bytes = data(i as u64 + 1, *size);
        let path = format!("f{i}.bin");
        served.insert(format!("/{id}/1/{path}"), bytes.clone());
        files.push((path, bytes));
    }
    let server = Server::start(served);
    let model_files: Vec<File> = files
        .iter()
        .map(|(path, bytes)| File {
            path: path.clone(),
            url: format!("{}/{id}/1/{path}", server.base),
            size: bytes.len() as u64,
            sha256: sha(bytes),
        })
        .collect();
    let model = Model {
        id: id.into(),
        version: "1".into(),
        kind: Kind::Aux,
        language: "any".into(),
        license: "MIT".into(),
        unpacked_size: model_files.iter().map(|f| f.size).sum(),
        requires: vec![],
        files: model_files,
    };
    let root =
        std::env::temp_dir().join(format!("voice-models-test-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    Fixture {
        server,
        manifest: Manifest::from_models(vec![model]).unwrap(),
        root,
    }
}

pub fn fast_options() -> Options {
    Options {
        retries: 4,
        backoff: Duration::from_millis(1),
    }
}

impl Fixture {
    pub fn file_url_path(&self, index: usize) -> String {
        format!("/m1/1/f{index}.bin")
    }

    pub fn bytes(&self, index: usize) -> &Vec<u8> {
        &self.server.files[&self.file_url_path(index)]
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

pub fn read_all(mut r: impl Read) -> Vec<u8> {
    let mut v = Vec::new();
    r.read_to_end(&mut v).unwrap();
    v
}

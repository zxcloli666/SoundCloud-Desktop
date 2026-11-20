use std::collections::VecDeque;
use std::io::Cursor;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use audiopus::coder::Encoder;
use audiopus::{Application, Channels, SampleRate};
use ogg::{PacketWriteEndInfo, PacketWriter};
use serde_json::{Value, json};
use tokio::net::TcpListener;
use tokio::time::Instant;
use voice_engine::Said;
use warp::Filter;
use warp::http::Response;

use super::answer::{CLIP_MOST, Made, REVISION, polled, posted};
use super::{CANCELLED, OGG, POLLED, POSTED, RETRY, TIMEOUT, TOTAL, checked, made, opus, within};
use crate::network::fetch::configured;
use crate::voice::api::{NETWORK, Request, Told};

const TOKEN: &str = "session-for-tests";
const SPOKEN: usize = 9_000;
const SILENT: usize = 2_400;
const FRAME: usize = 960;
const SERIAL: u32 = 7;
const PAGE: &[u8] = b"<html><body>Bad gateway</body></html>";
const NAMED: &str = "7";

type Reply = (u16, Vec<u8>);

struct Served {
    url: String,
    asked: Arc<Mutex<Vec<String>>>,
    sent: Arc<Mutex<Vec<Value>>>,
}

impl Served {
    fn asked(&self) -> Vec<String> {
        self.asked.lock().unwrap().clone()
    }
}

fn sound(at: usize) -> f32 {
    let tone = (std::f32::consts::TAU * 440.0 * at as f32 / 48_000.0).sin() * 0.5;
    if at < SILENT { 0.0 } else { tone }
}

fn ogg(spoken: usize) -> Vec<u8> {
    let encoder = Encoder::new(SampleRate::Hz48000, Channels::Mono, Application::Audio).unwrap();
    let pre_skip = encoder.lookahead().unwrap() as u16;
    let end = pre_skip as usize + spoken;
    let mut writer = PacketWriter::new(Cursor::new(Vec::new()));
    let mut head = b"OpusHead".to_vec();
    head.extend([1, 1]);
    head.extend(pre_skip.to_le_bytes());
    head.extend(48_000u32.to_le_bytes());
    head.extend([0, 0, 0]);
    let page = PacketWriteEndInfo::EndPage;
    writer.write_packet(head, SERIAL, page, 0).unwrap();
    let mut tags = b"OpusTags".to_vec();
    tags.extend([0; 8]);
    writer.write_packet(tags, SERIAL, page, 0).unwrap();
    let frames = end.div_ceil(FRAME);
    for index in 0..frames {
        let pcm: Vec<f32> = (index * FRAME..(index + 1) * FRAME).map(sound).collect();
        let mut data = vec![0u8; 4000];
        let made = encoder.encode_float(&pcm, &mut data).unwrap();
        data.truncate(made);
        let (info, granule) = if index + 1 == frames {
            (PacketWriteEndInfo::EndStream, end)
        } else {
            (PacketWriteEndInfo::NormalPacket, (index + 1) * FRAME)
        };
        writer
            .write_packet(data, SERIAL, info, granule as u64)
            .unwrap();
    }
    writer.into_inner().into_inner()
}

fn onset(samples: &[f32]) -> usize {
    samples
        .iter()
        .position(|sample| sample.abs() > 0.1)
        .unwrap()
}

fn error(code: &str) -> Vec<u8> {
    json!({ "code": code, "error": "Reason" })
        .to_string()
        .into_bytes()
}

fn ticket(id: &str) -> Vec<u8> {
    json!({ "id": id }).to_string().into_bytes()
}

fn body() -> Value {
    json!({ "voice": "loli", "text": "Ставлю на паузу.", "keep": true })
}

fn client() -> wreq::Client {
    configured(wreq::Client::builder().no_proxy())
        .build()
        .unwrap()
}

fn request<'a>(client: &'a wreq::Client, urls: &[String], body: &'a Value) -> Request<'a> {
    Request {
        client,
        method: wreq::Method::POST,
        urls: urls.to_vec(),
        token: TOKEN.into(),
        accept: OGG,
        body: Some(body),
        patience: POSTED,
    }
}

fn shown<T>(told: Told<T, String>, took: fn(T) -> String) -> String {
    match told {
        Told::Took(answer) => format!("took {}", took(answer)),
        Told::Refused(code) => format!("refused {code}"),
        Told::Elsewhere(code) => format!("elsewhere {code}"),
        Told::Lost(code) => format!("lost {}", code.unwrap_or_default()),
    }
}

fn made_shown(made: Made) -> String {
    match made {
        Made::Clip(said) => format!("clip {}", said.clip.samples.len()),
        Made::Ticket(ticket) => format!("ticket {ticket}"),
    }
}

fn polled_shown(said: Option<Said>) -> String {
    match said {
        Some(said) => format!("clip {}", said.clip.samples.len()),
        None => "later".into(),
    }
}

fn heard(said: Said) -> (usize, Option<String>) {
    (said.clip.samples.len(), said.revision)
}

fn reply((status, body): Reply) -> Response<Vec<u8>> {
    let kind = match status {
        200 => "audio/ogg",
        _ => "application/json",
    };
    Response::builder()
        .status(status)
        .header("content-type", kind)
        .header(REVISION, NAMED)
        .body(body)
        .unwrap()
}

async fn serve(answer: Reply, polls: Vec<Reply>) -> Served {
    let asked = Arc::new(Mutex::new(Vec::new()));
    let sent = Arc::new(Mutex::new(Vec::new()));
    let polls = Arc::new(Mutex::new(VecDeque::from(polls)));
    let (post_asked, post_sent) = (asked.clone(), sent.clone());
    let post = warp::post()
        .and(warp::path!("voice" / "speak"))
        .and(warp::header::<String>("x-session-id"))
        .and(warp::body::json())
        .map(move |token: String, body: Value| {
            post_asked.lock().unwrap().push(format!("POST {token}"));
            post_sent.lock().unwrap().push(body);
            reply(answer.clone())
        });
    let get_asked = asked.clone();
    let get = warp::get()
        .and(warp::path!("voice" / "speak" / String))
        .and(warp::header::<String>("x-session-id"))
        .then(move |id: String, token: String| {
            get_asked.lock().unwrap().push(format!("GET {id} {token}"));
            let next = polls.lock().unwrap().pop_front();
            async move {
                match next {
                    Some(next) => reply(next),
                    None => std::future::pending().await,
                }
            }
        });
    let (addr, server) = warp::serve(post.or(get)).bind_ephemeral(([127, 0, 0, 1], 0));
    tokio::spawn(server);
    Served {
        url: format!("http://{addr}/voice/speak"),
        asked,
        sent,
    }
}

async fn nowhere() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    drop(listener);
    format!("http://{addr}/voice/speak")
}

async fn hanging_up() -> (String, Arc<AtomicUsize>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let calls = Arc::new(AtomicUsize::new(0));
    let counted = calls.clone();
    tokio::spawn(async move {
        while let Ok((stream, _)) = listener.accept().await {
            counted.fetch_add(1, Ordering::Relaxed);
            drop(stream);
        }
    });
    (format!("http://{addr}/voice/speak/t-1"), calls)
}

#[test]
fn the_answer_to_the_post_is_a_clip_a_ticket_or_a_failure() {
    let cases = [
        (200, ogg(SPOKEN), "took clip 4500"),
        (200, PAGE.to_vec(), "lost bad_clip: not an ogg opus file"),
        (202, ticket("t-1"), "took ticket t-1"),
        (202, ticket("../t-1"), "lost http_202"),
        (204, Vec::new(), "lost http_204"),
        (
            429,
            error("voice_speak_limited"),
            "refused voice_speak_limited",
        ),
        (403, error("star_required"), "refused star_required"),
        (401, error("session"), "refused session"),
        (503, error("voice_speak_busy"), "elsewhere voice_speak_busy"),
        (502, PAGE.to_vec(), "lost http_502"),
    ];
    for (status, body, want) in cases {
        let told = posted(status, &body, None);
        assert_eq!(shown(told, made_shown), want, "{status}");
    }
}

#[test]
fn the_answer_to_a_poll_is_a_clip_not_yet_or_a_failure() {
    let cases = [
        (200, ogg(SPOKEN), "took clip 4500"),
        (204, Vec::new(), "took later"),
        (202, ticket("t-1"), "lost http_202"),
        (
            502,
            error("voice_speak_failed"),
            "elsewhere voice_speak_failed",
        ),
        (404, error("voice_speak_gone"), "refused voice_speak_gone"),
        (500, PAGE.to_vec(), "lost http_500"),
    ];
    for (status, body, want) in cases {
        let told = polled(status, &body, None);
        assert_eq!(shown(told, polled_shown), want, "{status}");
    }
}

#[test]
fn an_ogg_opus_clip_comes_at_the_engine_rate_without_the_pre_skip_and_the_padding() {
    let clip = opus::clip(&ogg(SPOKEN)).unwrap();
    assert_eq!(clip.rate, 24_000);
    assert_eq!(clip.samples.len(), SPOKEN / 2);
    let late = onset(&clip.samples).abs_diff(SILENT / 2);
    assert!(late < 80, "the sound starts {late} samples off");
}

#[test]
fn a_body_that_is_not_an_ogg_opus_clip_is_refused() {
    let cases = [
        (b"not a clip".to_vec(), "not an ogg opus file".to_string()),
        (Vec::new(), "not an ogg opus file".into()),
        (ogg(0), "the clip has no audio".into()),
        (vec![0; CLIP_MOST + 1], format!("over {CLIP_MOST} bytes")),
    ];
    for (body, why) in cases {
        let want = format!("lost bad_clip: {why}");
        assert_eq!(shown(posted(200, &body, None), made_shown), want);
        assert_eq!(shown(polled(200, &body, None), polled_shown), want);
    }
}

#[tokio::test(start_paused = true)]
async fn the_whole_wait_ends_at_the_bound() {
    let started = Instant::now();
    let said = within(std::future::pending(), TOTAL, &|| true).await;
    assert_eq!(said, Err(TIMEOUT.to_string()));
    assert!(started.elapsed() >= TOTAL, "{:?}", started.elapsed());
    assert!(started.elapsed() < TOTAL + Duration::from_secs(1));
}

#[tokio::test(start_paused = true)]
async fn the_wait_ends_at_once_when_the_line_is_not_wanted_any_more() {
    let started = Instant::now();
    let until = Duration::from_secs(3);
    let said = within(std::future::pending(), TOTAL, &|| started.elapsed() < until).await;
    assert_eq!(said, Err(CANCELLED.to_string()));
    assert!(started.elapsed() < until + Duration::from_millis(200));
}

#[tokio::test]
async fn a_clip_the_server_already_has_comes_with_the_post() {
    let served = serve((200, ogg(SPOKEN)), Vec::new()).await;
    let (client, body) = (client(), body());
    let said = made(&request(&client, &[served.url.clone()], &body)).await;
    assert_eq!(said.map(heard), Ok((SPOKEN / 2, Some(NAMED.to_string()))));
    assert_eq!(served.asked(), [format!("POST {TOKEN}")]);
    assert_eq!(*served.sent.lock().unwrap(), [body]);
}

#[tokio::test]
async fn a_ticket_is_polled_on_the_base_that_gave_it_until_the_clip_is_ready() {
    let polls = vec![(204, Vec::new()), (204, Vec::new()), (200, ogg(SPOKEN))];
    let served = serve((202, ticket("t-1")), polls).await;
    let (client, body) = (client(), body());
    let urls = [nowhere().await, served.url.clone()];
    let said = made(&request(&client, &urls, &body)).await;
    assert_eq!(said.map(heard), Ok((SPOKEN / 2, Some(NAMED.to_string()))));
    let poll = format!("GET t-1 {TOKEN}");
    let asked = [format!("POST {TOKEN}"), poll.clone(), poll.clone(), poll];
    assert_eq!(served.asked(), asked);
}

#[tokio::test]
async fn a_failed_poll_ends_the_wait_with_its_code() {
    let polls = vec![(204, Vec::new()), (502, error("voice_speak_failed"))];
    let served = serve((202, ticket("t-1")), polls).await;
    let (client, body) = (client(), body());
    let said = made(&request(&client, &[served.url.clone()], &body)).await;
    assert_eq!(said, Err("voice_speak_failed".to_string()));
    assert_eq!(served.asked().len(), 3);
}

#[tokio::test]
async fn a_refused_post_is_not_polled_and_keeps_its_code() {
    let served = serve((429, error("voice_speak_limited")), Vec::new()).await;
    let spare = serve((200, ogg(SPOKEN)), Vec::new()).await;
    let (client, body) = (client(), body());
    let urls = [served.url.clone(), spare.url.clone()];
    let said = made(&request(&client, &urls, &body)).await;
    assert_eq!(said, Err("voice_speak_limited".to_string()));
    assert!(spare.asked().is_empty());
}

#[tokio::test]
async fn a_line_that_is_not_wanted_any_more_stops_the_poll_in_flight() {
    let served = serve((202, ticket("t-1")), Vec::new()).await;
    let (client, body) = (client(), body());
    let urls = [served.url.clone()];
    let request = request(&client, &urls, &body);
    let started = Instant::now();
    let wanted = || served.asked().len() < 2;
    let said = within(made(&request), TOTAL, &wanted).await;
    assert_eq!(said, Err(CANCELLED.to_string()));
    assert!(started.elapsed() < Duration::from_secs(5));
    tokio::time::sleep(Duration::from_millis(300)).await;
    assert_eq!(served.asked().len(), 2);
}

#[tokio::test]
async fn a_poll_that_loses_the_network_is_tried_once_more_after_a_pause() {
    let (url, calls) = hanging_up().await;
    let (client, body) = (client(), body());
    let poll = request(&client, &[], &body).get_at(url, POLLED);
    let started = Instant::now();
    let said = checked(&poll).await;
    assert_eq!(said, Err(NETWORK.to_string()));
    assert_eq!(calls.load(Ordering::Relaxed), 2);
    assert!(started.elapsed() >= RETRY);
}

use std::sync::Mutex;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

use serde_json::{Value, json};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::{Notify, oneshot};
use voice_chat::ChatEvent;

use super::Refused;
use super::stream::{Patience, exchange};
use crate::network::fetch::configured;

const TOKEN: &str = "session-for-tests";
const STREAM: &str =
    "HTTP/1.1 200 OK\r\ncontent-type: text/event-stream\r\nconnection: close\r\n\r\n";
const ACTION: &str = "event: action\ndata: {\"name\":\"volume_set\",\"args\":{\"level\":40}}\n\n";
const HELLO: &str = "event: say\ndata: {\"text\":\"Сделала \"}\n\n";
const WORLD: &str = "event: say\ndata: {\"text\":\"потише.\"}\n\n";
const DONE: &str = "event: done\ndata: {}\n\n";
const DEADLINE: &str = "event: error\ndata: {\"code\":\"deadline\"}\n\n";
const LONG: Duration = Duration::from_secs(20);
const PAUSE: Duration = Duration::from_millis(150);

enum Step {
    Send(String),
    Wait(Duration),
    Hold,
}

struct Served {
    url: String,
    asked: oneshot::Receiver<String>,
    left: oneshot::Receiver<()>,
    calls: std::sync::Arc<AtomicUsize>,
}

#[derive(Default)]
struct Heard {
    events: Mutex<Vec<(Instant, ChatEvent)>>,
    first: Notify,
}

impl Heard {
    fn pass(&self, event: ChatEvent) {
        self.events.lock().unwrap().push((Instant::now(), event));
        self.first.notify_one();
    }

    fn list(&self) -> Vec<ChatEvent> {
        let events = self.events.lock().unwrap();
        events.iter().map(|(_, event)| event.clone()).collect()
    }

    fn spread(&self) -> Duration {
        let events = self.events.lock().unwrap();
        events.last().unwrap().0 - events.first().unwrap().0
    }
}

fn send(text: &str) -> Step {
    Step::Send(text.into())
}

fn say(text: &str) -> ChatEvent {
    ChatEvent::Say { text: text.into() }
}

fn action() -> ChatEvent {
    ChatEvent::Action {
        name: "volume_set".into(),
        args: json!({"level": 40}),
    }
}

fn body() -> Value {
    json!({"text": "сделай потише", "persona": "loli", "history": [], "tools": []})
}

fn patient() -> Patience {
    Patience {
        answer: LONG,
        silence: LONG,
    }
}

fn client() -> wreq::Client {
    configured(wreq::Client::builder().no_proxy())
        .build()
        .unwrap()
}

async fn asked(stream: &mut tokio::net::TcpStream) -> String {
    let mut raw = Vec::new();
    let mut buf = [0u8; 4096];
    let complete = |raw: &[u8]| {
        let text = String::from_utf8_lossy(raw).to_lowercase();
        let Some((head, sent)) = text.split_once("\r\n\r\n") else {
            return false;
        };
        let size = head
            .lines()
            .find_map(|line| line.strip_prefix("content-length:"))
            .and_then(|size| size.trim().parse::<usize>().ok());
        size.is_some_and(|size| sent.len() >= size)
    };
    while !complete(&raw) {
        let read = stream.read(&mut buf).await.unwrap_or(0);
        if read == 0 {
            break;
        }
        raw.extend_from_slice(&buf[..read]);
    }
    String::from_utf8_lossy(&raw).into_owned()
}

async fn serve(steps: Vec<Step>) -> Served {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let (seen, asked_rx) = oneshot::channel();
    let (gone, left) = oneshot::channel();
    let calls = std::sync::Arc::new(AtomicUsize::new(0));
    let counted = calls.clone();
    tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        counted.fetch_add(1, Ordering::Relaxed);
        let _ = seen.send(asked(&mut stream).await);
        for step in steps {
            match step {
                Step::Send(text) => {
                    let _ = stream.write_all(text.as_bytes()).await;
                }
                Step::Wait(time) => tokio::time::sleep(time).await,
                Step::Hold => {
                    let mut buf = [0u8; 64];
                    while stream.read(&mut buf).await.is_ok_and(|read| read > 0) {}
                    let _ = gone.send(());
                    return;
                }
            }
        }
    });
    Served {
        url: format!("http://{addr}/voice/chat"),
        asked: asked_rx,
        left,
        calls,
    }
}

async fn refusing(status: &str, body: &str) -> Served {
    let size = body.len();
    let reply = format!(
        "HTTP/1.1 {status}\r\ncontent-type: application/json\r\ncontent-length: {size}\r\n\r\n{body}"
    );
    serve(vec![Step::Send(reply)]).await
}

async fn nowhere() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    drop(listener);
    format!("http://{addr}/voice/chat")
}

async fn talk(urls: &[String], patience: Patience, heard: &Heard) -> Result<(), Refused> {
    let (_stay, cancelled) = oneshot::channel();
    let pass = |event| heard.pass(event);
    exchange(&client(), urls, TOKEN, &body(), patience, cancelled, &pass).await
}

#[tokio::test]
async fn events_arrive_while_the_reply_is_still_coming() {
    let served = serve(vec![
        send(STREAM),
        send(ACTION),
        Step::Wait(PAUSE),
        send(": keepalive\n\n"),
        send(HELLO),
        Step::Wait(PAUSE),
        send("event: say\ndata: {\"text\":"),
        Step::Wait(PAUSE),
        send("\"потише.\"}\n\n"),
        send(DONE),
        Step::Hold,
    ])
    .await;
    let heard = Heard::default();
    let result = talk(&[served.url], patient(), &heard).await;
    assert_eq!(result, Ok(()));
    assert_eq!(
        heard.list(),
        [action(), say("Сделала "), say("потише."), ChatEvent::Done]
    );
    assert!(heard.spread() >= PAUSE * 2, "{:?}", heard.spread());

    let request = served.asked.await.unwrap();
    let (head, sent) = request.split_once("\r\n\r\n").unwrap();
    let head = head.to_lowercase();
    assert!(head.starts_with("post /voice/chat http/1.1"), "{head}");
    assert!(head.contains(&format!("x-session-id: {TOKEN}")), "{head}");
    assert!(head.contains("accept: text/event-stream"), "{head}");
    assert!(head.contains("content-type: application/json"), "{head}");
    assert_eq!(serde_json::from_str::<Value>(sent).unwrap(), body());
}

#[tokio::test]
async fn a_reply_that_breaks_off_ends_with_a_network_error() {
    let served = serve(vec![send(STREAM), send(HELLO)]).await;
    let heard = Heard::default();
    assert_eq!(talk(&[served.url], patient(), &heard).await, Ok(()));
    assert_eq!(heard.list(), [say("Сделала "), ChatEvent::error("network")]);
}

#[tokio::test]
async fn an_error_from_the_server_ends_the_round_at_once() {
    let steps = vec![
        send(STREAM),
        send(HELLO),
        send(DEADLINE),
        send(WORLD),
        Step::Hold,
    ];
    let served = serve(steps).await;
    let heard = Heard::default();
    assert_eq!(talk(&[served.url], patient(), &heard).await, Ok(()));
    assert_eq!(
        heard.list(),
        [say("Сделала "), ChatEvent::error("deadline")]
    );
}

#[tokio::test]
async fn answers_before_the_stream_are_refusals_with_their_codes() {
    let cases = [
        (
            "403 Forbidden",
            "{\"error\":\"star_required\"}",
            "star_required",
        ),
        (
            "429 Too Many Requests",
            "{\"error\":\"rate_limited\"}",
            "rate_limited",
        ),
        (
            "503 Service Unavailable",
            "{\"error\":\"chat_unavailable\"}",
            "unavailable",
        ),
        ("401 Unauthorized", "{}", "session"),
        ("400 Bad Request", "{}", "bad_request"),
    ];
    for (status, reply, code) in cases {
        let served = refusing(status, reply).await;
        let heard = Heard::default();
        let result = talk(&[served.url], patient(), &heard).await;
        assert_eq!(result, Err(Refused { code }), "{status}");
        assert!(heard.list().is_empty(), "{status}");
    }
}

#[tokio::test]
async fn a_host_that_fails_gives_way_to_the_next_one() {
    let stream = || vec![send(STREAM), send(HELLO), send(DONE)];

    let good = serve(stream()).await;
    let heard = Heard::default();
    let urls = [nowhere().await, good.url];
    assert_eq!(talk(&urls, patient(), &heard).await, Ok(()));
    assert_eq!(heard.list(), [say("Сделала "), ChatEvent::Done]);

    let down = refusing("503 Service Unavailable", "{}").await;
    let good = serve(stream()).await;
    let heard = Heard::default();
    assert_eq!(talk(&[down.url, good.url], patient(), &heard).await, Ok(()));
    assert_eq!(heard.list(), [say("Сделала "), ChatEvent::Done]);
    assert_eq!(down.calls.load(Ordering::Relaxed), 1);
}

#[tokio::test]
async fn a_refusal_is_final_and_the_next_host_is_not_asked() {
    let limited = refusing("429 Too Many Requests", "{}").await;
    let spare = serve(vec![send(STREAM), send(DONE)]).await;
    let heard = Heard::default();
    let result = talk(&[limited.url, spare.url], patient(), &heard).await;
    assert_eq!(
        result,
        Err(Refused {
            code: "rate_limited"
        })
    );
    assert_eq!(spare.calls.load(Ordering::Relaxed), 0);
}

#[tokio::test]
async fn nowhere_to_go_is_a_network_refusal() {
    let heard = Heard::default();
    let urls = [nowhere().await, nowhere().await];
    assert_eq!(talk(&urls, patient(), &heard).await, Err(Refused::NETWORK));
    assert!(heard.list().is_empty());
}

#[tokio::test]
async fn no_answer_in_time_is_a_network_refusal() {
    let silent = serve(vec![Step::Hold]).await;
    let heard = Heard::default();
    let brief = Patience {
        answer: Duration::from_millis(300),
        silence: LONG,
    };
    assert_eq!(
        talk(&[silent.url], brief, &heard).await,
        Err(Refused::NETWORK)
    );
    assert!(tokio::time::timeout(LONG, silent.left).await.is_ok());
}

#[tokio::test]
async fn a_reply_that_goes_silent_ends_with_a_network_error() {
    let served = serve(vec![send(STREAM), send(HELLO), Step::Hold]).await;
    let heard = Heard::default();
    let brief = Patience {
        answer: LONG,
        silence: Duration::from_millis(300),
    };
    assert_eq!(talk(&[served.url], brief, &heard).await, Ok(()));
    assert_eq!(heard.list(), [say("Сделала "), ChatEvent::error("network")]);
    assert!(tokio::time::timeout(LONG, served.left).await.is_ok());
}

#[tokio::test]
async fn cancel_in_the_middle_closes_the_request() {
    let served = serve(vec![send(STREAM), send(HELLO), Step::Hold]).await;
    let heard = Heard::default();
    let (cancel, cancelled) = oneshot::channel();
    let pass = |event| heard.pass(event);
    let urls = [served.url];
    let (client, asked) = (client(), body());
    let round = exchange(&client, &urls, TOKEN, &asked, patient(), cancelled, &pass);
    let stop = async {
        heard.first.notified().await;
        let _ = cancel.send(());
    };
    let (result, ()) = tokio::join!(round, stop);
    assert_eq!(result, Ok(()));
    assert_eq!(heard.list(), [say("Сделала "), ChatEvent::Cancelled]);
    assert!(tokio::time::timeout(LONG, served.left).await.is_ok());
}

#[tokio::test]
async fn cancel_before_the_answer_closes_the_request() {
    let Served {
        url, asked, left, ..
    } = serve(vec![Step::Hold]).await;
    let heard = Heard::default();
    let (cancel, cancelled) = oneshot::channel();
    let pass = |event| heard.pass(event);
    let (client, urls, sent) = (client(), [url], body());
    let round = exchange(&client, &urls, TOKEN, &sent, patient(), cancelled, &pass);
    let stop = async {
        let _ = asked.await;
        let _ = cancel.send(());
    };
    let (result, ()) = tokio::join!(round, stop);
    assert_eq!(result, Ok(()));
    assert_eq!(heard.list(), [ChatEvent::Cancelled]);
    assert!(tokio::time::timeout(LONG, left).await.is_ok());
}

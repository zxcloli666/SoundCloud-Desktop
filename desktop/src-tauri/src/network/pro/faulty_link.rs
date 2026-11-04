use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

const OPEN: &[u8] = b"POST /open";

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Fault {
    Cut(usize),
    Stall(usize),
    LoseOpenAnswers(usize),
}

pub async fn link(target: &str, fault: Fault) -> String {
    let target = target.trim_start_matches("http://").to_string();
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let losses = Arc::new(AtomicUsize::new(match fault {
        Fault::LoseOpenAnswers(count) => count,
        _ => 0,
    }));
    tokio::spawn(async move {
        while let Ok((client, _)) = listener.accept().await {
            let Ok(upstream) = TcpStream::connect(&target).await else {
                continue;
            };
            tokio::spawn(pass(client, upstream, fault, losses.clone()));
        }
    });
    format!("http://{addr}")
}

async fn pass(client: TcpStream, upstream: TcpStream, fault: Fault, losses: Arc<AtomicUsize>) {
    if opens(&client).await && taken(&losses) {
        return lose_answer(client, upstream).await;
    }
    let budget = match fault {
        Fault::Cut(budget) | Fault::Stall(budget) => budget,
        Fault::LoseOpenAnswers(_) => usize::MAX,
    };
    let left = AtomicUsize::new(budget);
    let (mut client_read, mut client_write) = client.into_split();
    let (mut upstream_read, mut upstream_write) = upstream.into_split();
    let spent = tokio::select! {
        spent = carry(&mut client_read, &mut upstream_write, &left) => spent,
        spent = carry(&mut upstream_read, &mut client_write, &left) => spent,
    };
    if spent && matches!(fault, Fault::Stall(_)) {
        let mut sink = [0; 4096];
        while client_read.read(&mut sink).await.is_ok_and(|read| read > 0) {}
    }
}

async fn opens(client: &TcpStream) -> bool {
    let mut head = [0; OPEN.len()];
    client
        .peek(&mut head)
        .await
        .is_ok_and(|read| head[..read] == *OPEN)
}

fn taken(losses: &AtomicUsize) -> bool {
    losses
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |left| {
            left.checked_sub(1)
        })
        .is_ok()
}

async fn lose_answer(client: TcpStream, upstream: TcpStream) {
    let (mut client_read, _client_write) = client.into_split();
    let (mut upstream_read, mut upstream_write) = upstream.into_split();
    let mut first = [0; 1];
    tokio::select! {
        _ = tokio::io::copy(&mut client_read, &mut upstream_write) => {}
        _ = upstream_read.read(&mut first) => {}
    }
}

async fn carry<R, W>(from: &mut R, to: &mut W, left: &AtomicUsize) -> bool
where
    R: AsyncRead + Unpin,
    W: AsyncWrite + Unpin,
{
    let mut buffer = [0; 4096];
    loop {
        let read = match from.read(&mut buffer).await {
            Ok(0) | Err(_) => return false,
            Ok(read) => read,
        };
        let before = left
            .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |left| {
                Some(left.saturating_sub(read))
            })
            .unwrap_or(0);
        let allowed = before.min(read);
        if to.write_all(&buffer[..allowed]).await.is_err() {
            return false;
        }
        if allowed < read {
            return true;
        }
    }
}

use std::sync::Arc;
use std::time::Duration;

use futures_util::StreamExt;
use sc_chat::media::{Role, open_blob};
use sha2::{Digest, Sha256};

use crate::app::diagnostics;
use crate::network::edge::{self, Hop};
use crate::network::fetch;

const GET_TIMEOUT: Duration = Duration::from_secs(30);
const MISSING: u16 = 404;
const UNSIGNED: u16 = 403;

pub struct Expect {
    pub size: u64,
    pub cap: usize,
    pub sha256: Vec<u8>,
    pub seal: Option<Seal>,
}

pub struct Seal {
    pub key: Vec<u8>,
    pub nonce: Vec<u8>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Got {
    Body(Vec<u8>),
    Missing,
    Unsigned,
    Refused,
    Broken,
}

enum Tried {
    Body(Vec<u8>),
    Status(u16),
    Bad(&'static str),
    Broken(String),
}

pub async fn get(hops: &[Hop], expect: Arc<Expect>) -> Got {
    let Some(client) = fetch::client() else {
        return Got::Broken;
    };
    let mut unsigned = false;
    let mut refused = false;
    for hop in hops {
        match one(client, hop, expect.clone()).await {
            Tried::Body(body) => {
                hop.note(true);
                hop.note_delivered(body.len() as u64);
                return Got::Body(body);
            }
            Tried::Status(MISSING) => {
                hop.note(true);
                return Got::Missing;
            }
            Tried::Status(status) => {
                unsigned |= status == UNSIGNED;
                diagnostics::warn(format!(
                    "[ChatMedia] {} answered {status}",
                    hop.tier_label()
                ));
            }
            Tried::Bad(why) => {
                refused = true;
                diagnostics::warn(format!("[ChatMedia] {} sent {why}", hop.tier_label()));
            }
            Tried::Broken(why) => {
                hop.note(false);
                diagnostics::warn(format!("[ChatMedia] {}: {why}", hop.tier_label()));
            }
        }
    }
    match (refused, unsigned) {
        (true, _) => Got::Refused,
        (false, true) => Got::Unsigned,
        (false, false) => Got::Broken,
    }
}

async fn one(client: &wreq::Client, hop: &Hop, expect: Arc<Expect>) -> Tried {
    let response = match client.get(&hop.url).timeout(GET_TIMEOUT).send().await {
        Ok(response) => response,
        Err(error) => return Tried::Broken(error.to_string()),
    };
    if !edge::hop_ok(hop, &response) {
        return Tried::Broken(format!("transport {}", response.status().as_u16()));
    }
    let status = response.status().as_u16();
    if status != 200 {
        return Tried::Status(status);
    }
    let limit = match expect.size {
        0 => expect.cap as u64,
        size => size.min(expect.cap as u64),
    };
    if response
        .content_length()
        .is_some_and(|length| length > limit)
    {
        return Tried::Bad("an oversized body");
    }
    let mut body = Vec::new();
    let mut pieces = response.bytes_stream();
    while let Some(piece) = pieces.next().await {
        let piece = match piece {
            Ok(piece) => piece,
            Err(error) => return Tried::Broken(error.to_string()),
        };
        if (body.len() + piece.len()) as u64 > limit {
            return Tried::Bad("an oversized body");
        }
        body.extend_from_slice(&piece);
    }
    tokio::task::spawn_blocking(move || checked(body, &expect))
        .await
        .unwrap_or(Tried::Bad("a body that did not check"))
}

fn checked(body: Vec<u8>, expect: &Expect) -> Tried {
    if body.is_empty() || (expect.size > 0 && body.len() as u64 != expect.size) {
        return Tried::Bad("a body of the wrong size");
    }
    if !expect.sha256.is_empty() && Sha256::digest(&body)[..] != *expect.sha256 {
        return Tried::Bad("a body with the wrong sha256");
    }
    if let Some(seal) = &expect.seal
        && open_blob(Role::Thumb, &seal.key, &seal.nonce, &body).is_err()
    {
        return Tried::Bad("a body that does not open");
    }
    Tried::Body(body)
}

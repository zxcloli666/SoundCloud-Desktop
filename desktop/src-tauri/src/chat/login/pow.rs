use std::sync::Arc;
use std::sync::atomic::AtomicBool;

use sc_chat::sc_chat_wire::pow::{SEED_LEN, Ticket, solve};
use sc_chat::sc_chat_wire::proto::Pow;
use sc_chat::{ChatError, ChatResult};

use super::exchange::Signer;

pub async fn prove(
    signer: &Signer,
    path: &str,
    seed: Vec<u8>,
    effort: u32,
    cancel: Arc<AtomicBool>,
) -> ChatResult<Pow> {
    let seed: [u8; SEED_LEN] = seed.try_into().map_err(|_| ChatError::Protocol)?;
    let auth_pub = signer.keys.auth_public();
    let path = path.to_owned();
    let found = tokio::task::spawn_blocking(move || {
        let ticket = Ticket { seed, effort };
        solve(&ticket, &auth_pub, &path, cores(), &cancel)
    })
    .await
    .map_err(|_| ChatError::Internal)?;
    found.ok_or(ChatError::NotReady)
}

fn cores() -> usize {
    std::thread::available_parallelism().map_or(1, usize::from)
}

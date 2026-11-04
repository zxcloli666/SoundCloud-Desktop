use std::future::Future;

use sc_chat::channel::{BUSY_RETRY_MAX_MS, BUSY_RETRY_MS, Channel, InnerAnswer, InnerCall};
use sc_chat::crypto::DeviceKeys;
use sc_chat::login::seal_login;
use sc_chat::{
    ChatError, DeviceId, Tier, Transport, TransportError, TransportRequest, TransportResponse,
};

use super::wire;

pub struct Signer {
    pub device_id: DeviceId,
    pub keys: DeviceKeys,
}

pub struct Call {
    pub inner: InnerCall,
    pub session: Option<String>,
    pub timeout_ms: u64,
}

impl Call {
    pub fn new(inner: InnerCall, session: Option<String>, timeout_ms: u64) -> Self {
        Self {
            inner,
            session,
            timeout_ms,
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum Miss {
    Tier(ChatError),
    Fatal(ChatError),
}

pub async fn over_tiers<F, Fut>(
    order: Vec<Tier>,
    mut attempt: F,
) -> Result<(Tier, InnerAnswer), ChatError>
where
    F: FnMut(Tier) -> Fut,
    Fut: Future<Output = Result<InnerAnswer, Miss>>,
{
    let mut missed = ChatError::Offline;
    for tier in order {
        match attempt(tier).await {
            Ok(answer) => return Ok((tier, answer)),
            Err(Miss::Fatal(error)) => return Err(error),
            Err(Miss::Tier(error)) => missed = error,
        }
    }
    Err(missed)
}

pub async fn attempt(
    channel: &Channel,
    transport: &dyn Transport,
    signer: &Signer,
    call: &Call,
    tier: Tier,
) -> Result<InnerAnswer, Miss> {
    let answer = round(channel, transport, signer, call, tier).await?;
    let Some(server_now) = wire::server_now(&answer) else {
        return Ok(answer);
    };
    channel.note_server_now(server_now);
    round(channel, transport, signer, call, tier).await
}

async fn round(
    channel: &Channel,
    transport: &dyn Transport,
    signer: &Signer,
    call: &Call,
    tier: Tier,
) -> Result<InnerAnswer, Miss> {
    let mut sealed = seal_login(
        channel,
        &signer.keys,
        signer.device_id,
        &call.inner,
        call.session.as_deref(),
        tier,
    )
    .map_err(Miss::Fatal)?;
    let request = TransportRequest {
        tier,
        envelope: std::mem::take(&mut sealed.envelope),
        timeout_ms: call.timeout_ms,
        long_poll: false,
    };
    let response = transport.exchange(request).await.map_err(transport_miss)?;
    let body = outer(response)?;
    sealed.open(&body).map_err(Miss::Tier)
}

fn transport_miss(error: TransportError) -> Miss {
    match error {
        TransportError::Cancelled => Miss::Fatal(error.into()),
        _ => Miss::Tier(error.into()),
    }
}

pub fn outer(response: TransportResponse) -> Result<Vec<u8>, Miss> {
    match response.status {
        200 => Ok(response.body),
        413 => Err(Miss::Fatal(ChatError::Invalid)),
        503 => Err(match response.retry_after_ms {
            Some(retry_ms) => Miss::Fatal(ChatError::Busy {
                retry_ms: retry_ms.clamp(BUSY_RETRY_MS, BUSY_RETRY_MAX_MS),
            }),
            None => Miss::Tier(ChatError::Offline),
        }),
        400 => Err(Miss::Tier(ChatError::Protocol)),
        _ => Err(Miss::Tier(ChatError::Offline)),
    }
}

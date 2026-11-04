use std::time::Duration;

use sc_chat::ChatError;

const FIRST_WAIT_MS: u64 = 2_000;
const LONGEST_WAIT_MS: u64 = 60_000;
const PAUSED: Duration = Duration::from_secs(60);
const LIMITED: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Snag {
    Failed(ChatError),
    Expired,
    Missing,
}

impl From<ChatError> for Snag {
    fn from(error: ChatError) -> Self {
        Self::Failed(error)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    Retry,
    Later(Duration),
    Fatal,
    Wait,
}

pub fn outcome(error: &ChatError) -> Outcome {
    match error {
        ChatError::MediaUploadsPaused => Outcome::Later(PAUSED),
        ChatError::SendLimited | ChatError::RequestLimit | ChatError::ReadLimited => {
            Outcome::Later(LIMITED)
        }
        ChatError::Busy { retry_ms } => Outcome::Later(Duration::from_millis(
            (*retry_ms).clamp(FIRST_WAIT_MS, LONGEST_WAIT_MS),
        )),
        ChatError::MediaStarRequired
        | ChatError::RoomStarRequired
        | ChatError::QuotaExceeded { .. }
        | ChatError::Unavailable
        | ChatError::NotMember
        | ChatError::Invalid
        | ChatError::Disabled
        | ChatError::Crypto => Outcome::Fatal,
        ChatError::NotReady
        | ChatError::Store
        | ChatError::DeviceRevoked
        | ChatError::ReloginRequired
        | ChatError::SessionBoundOther
        | ChatError::TooYoung
        | ChatError::Clock { .. }
        | ChatError::Replay => Outcome::Wait,
        _ => Outcome::Retry,
    }
}

pub fn backoff(failures: u32) -> Duration {
    let step = failures.saturating_sub(1).min(8);
    let base = (FIRST_WAIT_MS << step).min(LONGEST_WAIT_MS);
    Duration::from_millis(base - base / 4 + jitter(base / 2))
}

fn jitter(max_ms: u64) -> u64 {
    let roll = sc_chat::sc_chat_wire::random_bytes::<8>()
        .map(u64::from_le_bytes)
        .unwrap_or(0);
    roll % (max_ms + 1)
}

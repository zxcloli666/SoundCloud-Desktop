mod answer;
mod opus;

#[cfg(test)]
mod tests;

use std::future::Future;
use std::time::Duration;

use serde_json::{Value, json};
use tokio::runtime::Handle;
use voice_engine::{Ask, Clip, Server};

use self::answer::Made;
use super::api::{self, Patience, Request};
use crate::rt::AppHandle;

const PATH: &str = "/voice/speak";
const OGG: &str = "audio/ogg";
const TOTAL: Duration = Duration::from_secs(100);
const POSTED: Patience = Patience {
    answer: Duration::from_secs(20),
    hop: Duration::from_secs(8),
    pro_hop: Duration::from_secs(20),
};
const POLLED: Patience = Patience {
    answer: Duration::from_secs(30),
    hop: Duration::from_secs(30),
    pro_hop: Duration::from_secs(30),
};
const RETRY: Duration = Duration::from_secs(1);
const WATCH: Duration = Duration::from_millis(100);
const TIMEOUT: &str = "timeout";
const CANCELLED: &str = "cancelled";

pub struct ApiServer {
    pub app: AppHandle,
    pub rt: Handle,
}

impl Server for ApiServer {
    fn say(&self, ask: &Ask, wanted: &dyn Fn() -> bool) -> Result<Clip, String> {
        let body = json!({ "voice": ask.voice, "text": ask.text, "keep": ask.kept });
        let said = speak(&self.app, &body);
        self.rt.block_on(within(said, TOTAL, wanted))
    }
}

async fn within(
    said: impl Future<Output = Result<Clip, String>>,
    total: Duration,
    wanted: &dyn Fn() -> bool,
) -> Result<Clip, String> {
    tokio::select! {
        said = tokio::time::timeout(total, said) => said.unwrap_or_else(|_| Err(TIMEOUT.into())),
        () = dropped(wanted) => Err(CANCELLED.into()),
    }
}

async fn speak(app: &AppHandle, body: &Value) -> Result<Clip, String> {
    let request = Request::post(app, PATH, OGG, body, POSTED).await?;
    made(&request).await
}

async fn made(request: &Request<'_>) -> Result<Clip, String> {
    let judge = |response, limit| answer::judged(response, limit, answer::posted);
    let (made, base) = api::send(request, api::NETWORK.to_string(), judge).await?;
    let ticket = match made {
        Made::Clip(clip) => return Ok(clip),
        Made::Ticket(ticket) => ticket,
    };
    let poll = request.get_at(format!("{base}/{ticket}"), POLLED);
    loop {
        if let Some(clip) = checked(&poll).await? {
            return Ok(clip);
        }
    }
}

async fn checked(poll: &Request<'_>) -> Result<Option<Clip>, String> {
    let judge = |response, limit| answer::judged(response, limit, answer::polled);
    let lost = || api::NETWORK.to_string();
    let said = match api::send(poll, lost(), judge).await {
        Err(code) if code == api::NETWORK => {
            tokio::time::sleep(RETRY).await;
            api::send(poll, lost(), judge).await
        }
        said => said,
    };
    said.map(|(clip, _)| clip)
}

async fn dropped(wanted: &dyn Fn() -> bool) {
    while wanted() {
        tokio::time::sleep(WATCH).await;
    }
}

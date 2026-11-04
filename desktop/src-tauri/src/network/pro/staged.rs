use std::ops::Range;

use super::Asked;
use super::open::{self, Opened, Unopened};
use super::stage::{self, Stage};

const ATTEMPTS: usize = 5;
const INCOMPLETE: u16 = 409;

pub async fn open(
    client: &'static wreq::Client,
    node: &str,
    asked: &Asked,
    body: &[u8],
) -> Result<Opened, String> {
    let Some((stage, missing)) = stage::create(client, node, body.len() as u64).await? else {
        return open::plain(client, node, asked)
            .await
            .map_err(Unopened::explained);
    };
    let opened = carried(client, node, asked, body, &stage, missing).await;
    if opened.is_err() {
        stage.close();
    }
    opened
}

async fn carried(
    client: &wreq::Client,
    node: &str,
    asked: &Asked,
    body: &[u8],
    stage: &Stage,
    mut missing: Vec<Range<u64>>,
) -> Result<Opened, String> {
    let mut last = String::new();
    for _ in 0..ATTEMPTS {
        stage.fill(body, missing).await?;
        match open::staged(client, node, asked, &stage.id).await {
            Ok(opened) => return Ok(opened),
            Err(Unopened::Refused(INCOMPLETE)) => missing = stage.missing().await?,
            Err(Unopened::Link(why)) => {
                last = why;
                missing = Vec::new();
            }
            Err(unopened) => return Err(unopened.explained()),
        }
    }
    Err(format!("pro: the staged request did not open: {last}"))
}

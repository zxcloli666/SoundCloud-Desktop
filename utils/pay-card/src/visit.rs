use std::time::Duration;

use serde::Serialize;
use tokio::time::timeout;

use crate::outcome::Outcome;
use crate::session::Session;

pub enum PageEnd {
    Done(Outcome),
    Closed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "end", rename_all = "lowercase")]
pub enum Visit {
    Result { outcome: Outcome },
    Closed,
    Refused,
}

pub async fn visit(
    session: &Session,
    url: &str,
    budget: Duration,
    window: impl AsyncFnOnce(String) -> PageEnd,
) -> Visit {
    if !session.takes_page(url) {
        return Visit::Refused;
    }
    match timeout(budget, window(url.to_string())).await {
        Ok(PageEnd::Done(outcome)) => Visit::Result { outcome },
        _ => Visit::Closed,
    }
}

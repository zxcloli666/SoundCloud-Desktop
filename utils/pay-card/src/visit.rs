use std::time::Duration;

use serde::Serialize;
use tokio::time::timeout;

use crate::outcome::Outcome;
use crate::session::Session;

pub enum PageEnd {
    Reached(String),
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
    let reached = match timeout(budget, window(url.to_string())).await {
        Ok(PageEnd::Reached(at)) => at,
        _ => return Visit::Closed,
    };
    let outcome = match session.result(reached).await {
        Ok(outcome) => outcome,
        Err(error) => Outcome::failed(error.code()),
    };
    Visit::Result { outcome }
}

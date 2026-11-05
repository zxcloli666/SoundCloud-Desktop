mod client;
mod hops;

use std::time::Duration;

use sc_chat::{Tier, Transport, TransportError, TransportRequest, TransportResponse, async_trait};

pub use hops::Route;

pub struct EdgeTransport {
    route: Route,
}

impl EdgeTransport {
    pub fn new(route: Route) -> Self {
        Self { route }
    }
}

#[async_trait]
impl Transport for EdgeTransport {
    fn tiers(&self) -> Vec<Tier> {
        self.route.tiers()
    }

    async fn exchange(
        &self,
        request: TransportRequest,
    ) -> Result<TransportResponse, TransportError> {
        let deadline = tokio::time::Instant::now() + Duration::from_millis(request.timeout_ms);
        let mut failure = TransportError::Unreachable;
        for hop in self.route.hops(request.tier) {
            match tokio::time::timeout_at(deadline, client::send(&hop, &request.envelope)).await {
                Err(_) => return Err(TransportError::Timeout),
                Ok(Ok(response)) => return Ok(response),
                Ok(Err(TransportError::Timeout)) => return Err(TransportError::Timeout),
                Ok(Err(error)) => failure = error,
            }
        }
        Err(failure)
    }
}

#[cfg(test)]
mod tests;

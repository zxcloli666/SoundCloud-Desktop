use std::time::Instant;

use wreq::{Client, Method, RequestBuilder};

use super::edge::Hop;
use super::fail::{self, FailKind};
use super::netcheck::model::Role;
use super::netcheck::paths;
use crate::diag::attempt::{self, Attempt};
use crate::diag::trace::{self, Resolved};

pub struct Flight {
    trace: String,
    span: String,
    debug: bool,
    method: Method,
    target: Option<Resolved>,
    hop: Hop,
    role: Role,
    source: &'static str,
    started: Instant,
}

pub fn begin(
    client: &Client,
    method: Method,
    hop: &Hop,
    role: Role,
    source: &'static str,
) -> (RequestBuilder, Flight) {
    let target = trace::resolve(&hop.url);
    let ours = target
        .as_ref()
        .is_some_and(|found| trace::allowed_host(&found.host));
    let trace = trace::current();
    let span = trace::new_span();
    let debug = trace::debug_active();
    let mut request = client.request(method.clone(), &hop.url);
    if ours {
        request = request.header("traceparent", trace::traceparent(&trace, &span, debug));
    }
    let flight = Flight {
        trace,
        span,
        debug,
        method,
        target: target.filter(|_| ours || !hop.origin.is_empty()),
        hop: hop.clone(),
        role,
        source,
        started: Instant::now(),
    };
    (request, flight)
}

impl Flight {
    pub fn unrecorded(mut self) -> Self {
        self.target = None;
        self
    }

    pub fn answered(self, status: u16, bytes: u64) {
        self.land(status, bytes, None, None);
    }

    pub fn failed(self, kind: FailKind, error: impl Into<String>) {
        self.land(0, 0, Some(kind), Some(error.into()));
    }

    pub fn cut(self, kind: FailKind, error: impl Into<String>, status: u16) {
        self.land(status, 0, Some(kind), Some(error.into()));
    }

    pub fn broke(self, error: &wreq::Error) -> FailKind {
        let kind = fail::of_wreq(error);
        self.failed(kind, error.to_string());
        kind
    }

    fn land(self, status: u16, bytes: u64, fail: Option<FailKind>, error: Option<String>) {
        let Some(target) = self.target else { return };
        let label_host = target.pro.as_deref().unwrap_or(&target.host);
        attempt::record(Attempt {
            at_ms: paths::now_ms(),
            trace: self.trace,
            span: self.span,
            debug: self.debug,
            service: attempt::service_of(&target.host),
            method: self.method.as_str().to_string(),
            path: target.path,
            hop: attempt::hop_label(label_host, self.hop.tier),
            origin: self.hop.origin,
            tier: self.hop.tier,
            role: self.role,
            source: self.source,
            status,
            ms: paths::millis(self.started.elapsed()),
            error,
            fail,
            bytes,
        });
    }
}

#[cfg(test)]
#[path = "traced_tests.rs"]
mod tests;

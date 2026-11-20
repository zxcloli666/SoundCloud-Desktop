use std::task::{Context, Poll};

use futures_util::future::{Either, Ready, ready};
use tower::{Layer, Service};

use super::{Offline, note_refused, on};

#[derive(Clone, Copy)]
struct Gate;

#[derive(Clone)]
struct Gated<S> {
    inner: S,
}

pub fn gate(builder: wreq::ClientBuilder) -> wreq::ClientBuilder {
    builder.layer(Gate)
}

impl<S> Layer<S> for Gate {
    type Service = Gated<S>;

    fn layer(&self, inner: S) -> Gated<S> {
        Gated { inner }
    }
}

impl<S, Request> Service<Request> for Gated<S>
where
    S: Service<Request>,
    S::Error: From<Offline>,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = Either<S::Future, Ready<Result<S::Response, S::Error>>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), S::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, request: Request) -> Self::Future {
        if on() {
            note_refused();
            return Either::Right(ready(Err(Offline.into())));
        }
        Either::Left(self.inner.call(request))
    }
}

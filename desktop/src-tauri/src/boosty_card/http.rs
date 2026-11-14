use std::time::Duration;

use boosty_card::{Fetch, Request, Response};
use futures_util::StreamExt;
use wreq::Method;
use wreq::redirect::Policy;

use crate::network::system_proxy::follow;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(8);
const TOTAL_TIMEOUT: Duration = Duration::from_secs(20);
const MAX_BODY: usize = 1 << 20;

pub struct DirectFetch {
    client: wreq::Client,
    runtime: tokio::runtime::Handle,
}

impl DirectFetch {
    pub fn new(runtime: tokio::runtime::Handle) -> Option<Self> {
        let client = follow(sc_fingerprint::builder(None))
            .redirect(Policy::none())
            .connect_timeout(CONNECT_TIMEOUT)
            .timeout(TOTAL_TIMEOUT)
            .pool_max_idle_per_host(0)
            .build()
            .ok()?;
        Some(Self { client, runtime })
    }

    async fn send(&self, request: Request) -> Response {
        let Ok(method) = Method::from_bytes(request.method.to_ascii_uppercase().as_bytes()) else {
            return failure("method");
        };
        let mut builder = self.client.request(method, request.url.as_str());
        for (name, value) in &request.headers {
            builder = builder.header(name.as_str(), value.as_str());
        }
        if !request.body.is_empty() {
            builder = builder.body(request.body);
        }
        let response = match builder.send().await {
            Ok(response) => response,
            Err(error) => return failure(describe(&error)),
        };
        let status = response.status().as_u16();
        let mut stream = response.bytes_stream();
        let mut body = Vec::new();
        while let Some(chunk) = stream.next().await {
            match chunk {
                Ok(bytes) if body.len() + bytes.len() <= MAX_BODY => body.extend_from_slice(&bytes),
                Ok(_) => return failure("too_big"),
                Err(error) => return failure(describe(&error)),
            }
        }
        Response {
            status,
            body,
            error: None,
        }
    }
}

impl Fetch for DirectFetch {
    fn call(&self, request: Request) -> Response {
        self.runtime.block_on(self.send(request))
    }
}

fn failure(error: &str) -> Response {
    Response {
        status: 0,
        body: Vec::new(),
        error: Some(error.to_string()),
    }
}

fn describe(error: &wreq::Error) -> &'static str {
    if error.is_timeout() {
        "timeout"
    } else if error.is_connect() {
        "connect"
    } else {
        "request"
    }
}

use std::time::Duration;

use wreq::Client;
use serde::Serialize;

use super::model::{Sample, Topology};
use crate::network::edge;
use crate::network::pro::{self, Asked};

const DELIVERY_TIMEOUT: Duration = Duration::from_secs(6);
const MAX_SAMPLES: usize = 256;
const INGEST: &str = "health";

#[derive(Serialize)]
struct Report<'a> {
    client: &'a str,
    version: &'a str,
    topology: u32,
    samples: &'a [Sample],
}

pub struct Delivery {
    client: Client,
}

impl Delivery {
    pub fn new(client: Client) -> Self {
        Self { client }
    }

    pub async fn fetch_topology(&self) -> Option<Topology> {
        for host in edge::relay_hosts(INGEST) {
            let url = format!("https://{host}/topology");
            let Ok(response) = self.client.get(&url).timeout(DELIVERY_TIMEOUT).send().await else {
                continue;
            };
            if !response.status().is_success() {
                continue;
            }
            if let Ok(fresh) = response.json::<Topology>().await {
                return Some(fresh.sanitized());
            }
        }
        let fresh = through_pro(asked("GET", "topology", None)).await?;
        serde_json::from_slice::<Topology>(&fresh)
            .ok()
            .map(Topology::sanitized)
    }

    pub async fn report(
        &self,
        topology: &Topology,
        client_id: &str,
        app_version: &str,
        samples: &[Sample],
    ) -> bool {
        if samples.is_empty() {
            return true;
        }
        let Ok(body) = serde_json::to_vec(&Report {
            client: client_id,
            version: app_version,
            topology: topology.version,
            samples: &samples[..samples.len().min(MAX_SAMPLES)],
        }) else {
            return false;
        };

        for host in edge::relay_hosts(INGEST) {
            let url = format!("https://{host}/report");
            let request = self
                .client
                .post(&url)
                .header(wreq::header::CONTENT_TYPE, "application/json")
                .body(body.clone())
                .timeout(DELIVERY_TIMEOUT);
            if request
                .send()
                .await
                .is_ok_and(|response| response.status().is_success())
            {
                return true;
            }
        }
        through_pro(asked("POST", "report", Some(body)))
            .await
            .is_some()
    }
}

fn asked(method: &str, path: &str, body: Option<Vec<u8>>) -> Asked {
    Asked {
        method: method.to_string(),
        url: format!("https://{}/{path}", edge::plain_host(INGEST)),
        headers: vec![("content-type".to_string(), "application/json".to_string())],
        body,
    }
}

async fn through_pro(asked: Asked) -> Option<Vec<u8>> {
    for host in edge::pro_hosts() {
        if let Ok((status, body)) = pro::whole(&host, asked.clone()).await
            && (200..300).contains(&status)
        {
            return Some(body);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    use super::Delivery;
    use crate::network::h2_server::acceptor;
    use crate::network::health::model::Sample;

    type Seen = Arc<Mutex<Vec<(String, String)>>>;

    async fn head(stream: &mut (impl AsyncRead + Unpin)) -> String {
        let mut head = Vec::new();
        while !head.ends_with(b"\r\n\r\n") {
            let byte = stream.read_u8().await.unwrap();
            head.push(byte);
        }
        String::from_utf8(head).unwrap()
    }

    fn first_line(head: &str) -> String {
        head.lines().next().unwrap().to_string()
    }

    fn content_length(head: &str) -> usize {
        head.lines()
            .find_map(|line| {
                let line = line.to_ascii_lowercase();
                line.strip_prefix("content-length:")
                    .map(|length| length.trim().parse().unwrap())
            })
            .unwrap_or(0)
    }

    async fn relay_proxy() -> (String, Seen) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let seen = Seen::default();
        let log = seen.clone();
        let acceptor = acceptor(&[b"http/1.1"]);
        tokio::spawn(async move {
            while let Ok((mut socket, _)) = listener.accept().await {
                let acceptor = acceptor.clone();
                let log = log.clone();
                tokio::spawn(async move {
                    let connect = head(&mut socket).await;
                    socket
                        .write_all(b"HTTP/1.1 200 Connection established\r\n\r\n")
                        .await
                        .unwrap();
                    let mut stream = acceptor.accept(socket).await.unwrap();
                    let request = head(&mut stream).await;
                    let mut body = vec![0; content_length(&request)];
                    stream.read_exact(&mut body).await.unwrap();
                    log.lock()
                        .unwrap()
                        .push((first_line(&connect), first_line(&request)));
                    let answer = br#"{"version":33,"relays":["r1"]}"#;
                    let reply = format!(
                        "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n",
                        answer.len()
                    );
                    stream.write_all(reply.as_bytes()).await.unwrap();
                    stream.write_all(answer).await.unwrap();
                    stream.shutdown().await.ok();
                });
            }
        });
        (format!("http://{addr}"), seen)
    }

    fn through(proxy: &str) -> Delivery {
        let client = wreq::Client::builder()
            .proxy(wreq::Proxy::all(proxy).unwrap())
            .tls_cert_verification(false)
            .build()
            .unwrap();
        Delivery::new(client)
    }

    fn relay_named(connect: &str) -> bool {
        connect
            .strip_prefix("CONNECT health.")
            .and_then(|rest| rest.split_whitespace().next())
            .and_then(|target| target.strip_suffix(".relay.scnative.dev:443"))
            .is_some_and(|node| !node.is_empty() && !node.contains('.'))
    }

    #[tokio::test]
    async fn topology_and_report_go_to_the_health_relay_names() {
        let (proxy, seen) = relay_proxy().await;
        let delivery = through(&proxy);

        let topology = delivery.fetch_topology().await.unwrap();
        assert_eq!(topology.version, 33);
        let sample = Sample {
            ep: "@r1".to_string(),
            via: "direct".to_string(),
            ok: true,
            ms: None,
            fail: None,
            link: None,
        };
        assert!(delivery.report(&topology, "c", "1", &[sample]).await);

        let seen = seen.lock().unwrap().clone();
        assert_eq!(seen.len(), 2, "{seen:?}");
        assert!(
            seen.iter().all(|(connect, _)| relay_named(connect)),
            "{seen:?}"
        );
        assert_eq!(seen[0].1, "GET /topology HTTP/1.1");
        assert_eq!(seen[1].1, "POST /report HTTP/1.1");
    }
}

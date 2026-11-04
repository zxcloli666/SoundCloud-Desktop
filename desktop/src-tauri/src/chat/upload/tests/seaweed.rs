use std::collections::BTreeMap;

use bytes::Bytes;
use sc_chat::api::wire::PresignedPut;
use sha2::{Digest, Sha256};
use tokio::sync::watch;
use uuid::Uuid;

use crate::chat::upload::plain::plain;
use crate::network::pro::fake_relay::{self, Kind};
use crate::network::pro::{Asked, Staging, fill_stage, open_filled};

const TYPE: &str = "application/octet-stream";
const ACCESS: &str = "UPTESTAK";
const SECRET: &str = "UPTESTSECRET";
const REGION: &str = "us-east-1";
const LEN: usize = 176_128;

#[tokio::test(flavor = "multi_thread")]
#[ignore = "needs a SeaweedFS S3 at CHAT_SEAWEED=host:port with UPTESTAK/UPTESTSECRET and bucket scd-chat"]
async fn a_streamed_put_lands_on_a_real_seaweedfs_presign_and_a_wrong_length_is_refused() {
    let host = std::env::var("CHAT_SEAWEED").unwrap();
    let path = format!("/scd-chat/m/{}", Uuid::new_v4().simple());
    let body: Vec<u8> = (0..LEN).map(|at| (at * 31 % 251) as u8).collect();

    let signed = put_target(&host, &path, LEN);
    let short = put_target(&host, &path, LEN - 4096);
    let (progress, _) = watch::channel(Staging::default());
    let sent = Bytes::from(body[..LEN - 4096].to_vec());
    assert_eq!(plain(&signed.url, &short, sent, progress).await, Ok(403));

    let target = put_target(&host, &path, LEN);
    let (progress, seen) = watch::channel(Staging::default());
    let stored = plain(&target.url, &target, Bytes::from(body.clone()), progress).await;
    assert_eq!(stored, Ok(200));
    assert_eq!(seen.borrow().sent, LEN as u64);
    assert_eq!(read_back(&host, &path).await, body);
}

#[tokio::test(flavor = "multi_thread")]
#[ignore = "needs a SeaweedFS S3 at CHAT_SEAWEED=host:port with UPTESTAK/UPTESTSECRET and bucket scd-chat"]
async fn a_staged_put_a_node_replays_lands_on_a_real_seaweedfs_presign() {
    let host = std::env::var("CHAT_SEAWEED").unwrap();
    let path = format!("/scd-chat/m/{}", Uuid::new_v4().simple());
    let body: Vec<u8> = (0..LEN).map(|at| (at * 17 % 241) as u8).collect();
    let target = put_target(&host, &path, LEN);
    let node = fake_relay::serve(Kind::Forwards);
    let asked = Asked {
        method: "PUT".into(),
        url: target.url.clone(),
        headers: target
            .headers
            .iter()
            .map(|(name, value)| (name.clone(), value.clone()))
            .collect(),
        body: None,
    };
    let (progress, _) = watch::channel(Staging::default());
    let filled = fill_stage(&node.url, &body, None, &progress).await.unwrap();
    let stored = open_filled(&node.url, &asked, &body, &filled, &progress).await;
    assert_eq!(stored, Ok(200));
    assert_eq!(node.stages_opened(), 1);
    assert_eq!(read_back(&host, &path).await, body);
}

async fn read_back(host: &str, path: &str) -> Vec<u8> {
    let read = presign(host, "GET", path, &[]);
    let back = wreq::Client::new().get(&read).send().await.unwrap();
    assert_eq!(back.status().as_u16(), 200);
    back.bytes().await.unwrap().to_vec()
}

fn put_target(host: &str, path: &str, len: usize) -> PresignedPut {
    let headers = [
        ("content-length", len.to_string()),
        ("content-type", TYPE.to_string()),
    ];
    PresignedPut {
        url: presign(host, "PUT", path, &headers),
        headers: headers
            .iter()
            .map(|(name, value)| (name.to_string(), value.clone()))
            .collect(),
    }
}

fn presign(host: &str, method: &str, path: &str, headers: &[(&str, String)]) -> String {
    let now = chrono::Utc::now();
    let (stamp, day) = (
        now.format("%Y%m%dT%H%M%SZ").to_string(),
        now.format("%Y%m%d").to_string(),
    );
    let scope = format!("{day}/{REGION}/s3/aws4_request");
    let mut signed: BTreeMap<&str, String> = headers.iter().cloned().collect();
    signed.insert("host", host.to_string());
    let names = signed.keys().copied().collect::<Vec<_>>().join(";");
    let query = [
        ("X-Amz-Algorithm", "AWS4-HMAC-SHA256".to_string()),
        ("X-Amz-Credential", format!("{ACCESS}/{scope}")),
        ("X-Amz-Date", stamp.clone()),
        ("X-Amz-Expires", "600".to_string()),
        ("X-Amz-SignedHeaders", names.clone()),
    ]
    .iter()
    .map(|(name, value)| format!("{name}={}", encode(value)))
    .collect::<Vec<_>>()
    .join("&");
    let lines: String = signed
        .iter()
        .map(|(name, value)| format!("{name}:{value}\n"))
        .collect();
    let request = format!("{method}\n{path}\n{query}\n{lines}\n{names}\nUNSIGNED-PAYLOAD");
    let digest = hex::encode(Sha256::digest(request.as_bytes()));
    let to_sign = format!("AWS4-HMAC-SHA256\n{stamp}\n{scope}\n{digest}");
    let key = [day.as_str(), REGION, "s3", "aws4_request"]
        .iter()
        .fold(format!("AWS4{SECRET}").into_bytes(), |key, part| {
            hmac(&key, part.as_bytes())
        });
    let signature = hex::encode(hmac(&key, to_sign.as_bytes()));
    format!("http://{host}{path}?{query}&X-Amz-Signature={signature}")
}

fn hmac(key: &[u8], message: &[u8]) -> Vec<u8> {
    let mut block = [0u8; 64];
    block[..key.len()].copy_from_slice(key);
    let pad = |byte: u8| block.iter().map(|at| at ^ byte).collect::<Vec<u8>>();
    let inner = Sha256::new()
        .chain_update(pad(0x36))
        .chain_update(message)
        .finalize();
    Sha256::new()
        .chain_update(pad(0x5c))
        .chain_update(inner)
        .finalize()
        .to_vec()
}

fn encode(value: &str) -> String {
    value
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (byte as char).to_string()
            }
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

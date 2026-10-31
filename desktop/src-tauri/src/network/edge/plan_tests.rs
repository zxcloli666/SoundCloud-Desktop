use std::time::Instant;

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD as BASE64_URL};

use super::config;
use super::name::SERVICES;
use super::plan::{Pro, plan_in};
use super::state::Inner;
use super::{Hop, Tier, transport_failure};

const GATEWAY: &str = "http://127.0.0.1:4321/pro/p1.pro.scnative.dev/";

fn inner() -> Inner {
    let mut inner = Inner::default();
    inner.pool.relays = vec!["r2".to_string(), "r3".to_string()];
    inner.gateway_port = Some(4321);
    inner
}

fn plan(inner: &Inner, url: &str, pro: Pro) -> Vec<Hop> {
    plan_in(inner, url, pro, Instant::now())
}

fn tiers(hops: &[Hop]) -> Vec<Tier> {
    hops.iter().map(|hop| hop.tier).collect()
}

fn urls(hops: &[Hop]) -> Vec<&str> {
    hops.iter().map(|hop| hop.url.as_str()).collect()
}

fn carried(hop: &Hop) -> String {
    let encoded = hop.url.strip_prefix(GATEWAY).unwrap();
    String::from_utf8(BASE64_URL.decode(encoded).unwrap()).unwrap()
}

fn host(hop: &Hop) -> String {
    url::Url::parse(&hop.url)
        .unwrap()
        .host_str()
        .unwrap()
        .to_string()
}

#[test]
fn every_host_form_maps_to_our_relays_with_the_same_path_and_query() {
    let path = "/tracks/a1/hq.m4a?sig=x%2By&X-Amz-Signature=ab%2Fcd";
    for host in [
        "storage-star.scnative.dev",
        "storage-star.scnative.space",
        "storage-star.r1.relay.scnative.dev",
        "storage-star.r3.relay.scnative.space",
        "storage-star.scdinternal.site",
        "storage-star.temp.scdinternal.site",
    ] {
        let url = format!("https://{host}{path}");
        let hops = plan(&inner(), &url, Pro::Last);
        assert_eq!(
            urls(&hops[..2]),
            [
                format!("https://storage-star.r2.relay.scnative.dev{path}"),
                format!("https://storage-star.r3.relay.scnative.dev{path}"),
            ],
            "{host}"
        );
        assert_eq!(
            tiers(&hops),
            [Tier::Relay, Tier::Relay, Tier::Pro],
            "{host}"
        );
        assert_eq!(
            carried(&hops[2]),
            format!("https://storage-star.scnative.dev{path}")
        );
        assert!(hops.iter().all(|hop| hop.origin == "storage-star"));
    }
    let internal = plan(&inner(), "http://api.scdinternal.site:81/me", Pro::Never);
    assert_eq!(urls(&internal)[0], "https://api.r2.relay.scnative.dev/me");
}

#[test]
fn a_relay_named_in_the_url_does_not_jump_the_pool_order() {
    let url = "https://stream-star.r3.relay.scnative.dev/tracks/a1/stream?quality=hq";
    for pro in [Pro::Last, Pro::WhenPinned, Pro::Never] {
        let hops = plan(&inner(), url, pro);
        assert_eq!(
            urls(&hops[..2]),
            [
                "https://stream-star.r2.relay.scnative.dev/tracks/a1/stream?quality=hq",
                "https://stream-star.r3.relay.scnative.dev/tracks/a1/stream?quality=hq",
            ]
        );
    }
}

#[test]
fn no_hop_of_a_relay_only_service_targets_its_plain_name() {
    let mut pinned = inner();
    for label in SERVICES {
        pinned.conclude(label, Tier::Pro, Instant::now());
    }
    for label in SERVICES.into_iter().filter(|label| *label != "images") {
        for zone in ["scnative.dev", "scnative.space"] {
            let url = format!("https://{label}.{zone}/x?y=1");
            for state in [&inner(), &pinned] {
                for pro in [Pro::Last, Pro::WhenPinned, Pro::Never] {
                    let hops = plan(state, &url, pro);
                    assert!(!hops.is_empty(), "{url}");
                    for hop in &hops {
                        let host = host(hop);
                        assert!(
                            host.ends_with(".relay.scnative.dev") || host == "127.0.0.1",
                            "{url} -> {}",
                            hop.url
                        );
                    }
                }
            }
        }
    }
}

#[test]
fn an_unknown_label_never_yields_a_hop() {
    for url in [
        "https://nats-public.scnative.dev/x",
        "https://call-1.scnative.dev/health",
        "https://r1.relay.scnative.dev/probe",
        "https://p1.pro.scnative.dev/health",
        "https://nope.r2.relay.scnative.space/x",
        "https://admin.temp.scdinternal.site/",
    ] {
        for pro in [Pro::Last, Pro::WhenPinned, Pro::Never] {
            assert!(plan(&inner(), url, pro).is_empty(), "{url}");
        }
    }
}

#[test]
fn a_foreign_url_goes_as_it_is() {
    let url = "https://api-v2.soundcloud.com/tracks?id=1";
    let hops = plan(&inner(), url, Pro::Last);
    assert_eq!(urls(&hops), [url]);
    assert_eq!(hops[0].tier, Tier::Direct);
    assert!(hops[0].origin.is_empty());
}

#[test]
fn a_relay_only_service_tries_pro_last_and_pro_first_once_pinned() {
    let url = "https://stream.scnative.space/tracks/a1/stream";
    let mut state = inner();
    assert_eq!(
        tiers(&plan(&state, url, Pro::Last)),
        [Tier::Relay, Tier::Relay, Tier::Pro]
    );
    assert_eq!(
        tiers(&plan(&state, url, Pro::WhenPinned)),
        [Tier::Relay, Tier::Relay]
    );
    state.conclude("stream", Tier::Pro, Instant::now());
    for pro in [Pro::Last, Pro::WhenPinned] {
        assert_eq!(
            tiers(&plan(&state, url, pro)),
            [Tier::Pro, Tier::Relay, Tier::Relay]
        );
    }
    assert_eq!(
        tiers(&plan(&state, url, Pro::Never)),
        [Tier::Relay, Tier::Relay]
    );
    let storage = plan(&state, "https://storage.scnative.space/a1.m4a", Pro::Last);
    assert_eq!(storage[0].tier, Tier::Pro);
}

#[test]
fn images_still_plans_direct_first() {
    let mut state = inner();
    for url in [
        "https://images.scnative.dev/a.jpg",
        "https://images.scnative.space/a.jpg",
    ] {
        let hops = plan(&state, url, Pro::Last);
        assert_eq!(
            urls(&hops),
            [
                "https://images.scnative.dev/a.jpg",
                "https://images.r2.relay.scnative.dev/a.jpg",
                "https://images.r3.relay.scnative.dev/a.jpg",
            ]
        );
        assert_eq!(tiers(&hops), [Tier::Direct, Tier::Relay, Tier::Relay]);
    }
    let url = "https://images.scnative.dev/a.jpg";
    state.conclude("images", Tier::Relay, Instant::now());
    assert_eq!(
        tiers(&plan(&state, url, Pro::Last)),
        [Tier::Relay, Tier::Relay, Tier::Direct]
    );
    state.conclude("images", Tier::Pro, Instant::now());
    let hops = plan(&state, url, Pro::Last);
    assert_eq!(tiers(&hops), [Tier::Pro]);
    assert_eq!(carried(&hops[0]), url);
}

#[test]
fn without_a_published_pool_the_bootstrap_relay_is_used() {
    let hops = plan(&Inner::default(), "https://api.scnative.dev/me", Pro::Last);
    assert_eq!(urls(&hops), ["https://api.r1.relay.scnative.dev/me"]);
}

#[test]
fn the_frontend_mirror_gets_keys_relays_and_only_images_direct() {
    let config = serde_json::to_value(config::of(&inner(), Instant::now())).unwrap();
    assert_eq!(config["keys"]["stream.scnative.space"], "stream");
    assert_eq!(config["keys"]["stream.scnative.dev"], "stream");
    assert_eq!(
        config["relays"]["stream"],
        serde_json::json!([
            "stream.r2.relay.scnative.dev",
            "stream.r3.relay.scnative.dev"
        ])
    );
    assert_eq!(config["origins"]["pay"], "pay.scnative.dev");
    assert_eq!(config["direct"], serde_json::json!(["images"]));
    assert_eq!(config["hints"]["api"], "relay");
    assert_eq!(config["hints"]["images"], "direct");
    assert_eq!(config["pro"], serde_json::json!([GATEWAY]));
}

#[test]
fn html_gateway_5xx_is_a_direct_transport_error() {
    assert!(transport_failure(
        Tier::Direct,
        503,
        "text/html; charset=utf-8"
    ));
    assert!(transport_failure(Tier::Direct, 504, "TEXT/HTML"));
    assert!(!transport_failure(Tier::Direct, 500, "text/html"));
    assert!(!transport_failure(Tier::Direct, 503, "application/json"));
    assert!(!transport_failure(Tier::Direct, 421, "text/plain"));
}

#[test]
fn an_origin_timeout_through_a_relay_is_the_server_answer() {
    assert!(!transport_failure(
        Tier::Relay,
        504,
        "text/plain; charset=utf-8"
    ));
    assert!(transport_failure(Tier::Relay, 504, "text/html"));
    assert!(transport_failure(Tier::Relay, 502, "text/html"));
    assert!(transport_failure(Tier::Relay, 421, ""));
}

#[test]
fn json_5xx_through_a_relay_is_an_origin_answer() {
    assert!(transport_failure(Tier::Relay, 421, "application/json"));
    assert!(transport_failure(Tier::Relay, 503, "text/html"));
    assert!(transport_failure(Tier::Relay, 502, ""));
    assert!(!transport_failure(
        Tier::Relay,
        503,
        "application/json; charset=utf-8"
    ));
    assert!(!transport_failure(Tier::Relay, 500, "text/html"));
}

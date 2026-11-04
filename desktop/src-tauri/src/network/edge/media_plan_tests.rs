use std::time::{Duration, Instant};

use super::plan::media_plan_in;
use super::state::Inner;
use super::{Hop, Tier};

const PUT: &str =
    "https://s3.scnative.dev/scd-chat/m/0a1b?X-Amz-Signature=ab%2Fcd&X-Amz-Expires=600";

fn inner() -> Inner {
    let mut inner = Inner::default();
    inner.pool.relays = vec!["r1".to_string(), "r2".to_string()];
    inner.pool.pros = vec!["p1".to_string(), "p2".to_string()];
    inner
}

fn shown(hops: &[Hop]) -> Vec<(Tier, &str)> {
    hops.iter()
        .map(|hop| (hop.tier, hop.url.as_str()))
        .collect()
}

#[test]
fn a_presigned_put_goes_to_every_relay_first_then_stages_on_every_pro_node() {
    let hops = media_plan_in(&inner(), PUT, Instant::now());
    assert_eq!(
        shown(&hops),
        [
            (
                Tier::Relay,
                "https://s3.r1.relay.scnative.dev/scd-chat/m/0a1b?X-Amz-Signature=ab%2Fcd&X-Amz-Expires=600"
            ),
            (
                Tier::Relay,
                "https://s3.r2.relay.scnative.dev/scd-chat/m/0a1b?X-Amz-Signature=ab%2Fcd&X-Amz-Expires=600"
            ),
            (Tier::Pro, "https://p1.pro.scnative.dev"),
            (Tier::Pro, "https://p2.pro.scnative.dev"),
        ]
    );
    assert!(hops.iter().all(|hop| hop.origin == "s3"));
}

#[test]
fn an_s3_origin_pinned_to_pro_stages_first_and_keeps_relays_as_the_reserve() {
    let mut inner = inner();
    let now = Instant::now();
    inner.conclude("s3", Tier::Pro, now);
    let hops = media_plan_in(&inner, PUT, now + Duration::from_secs(1));
    let tiers: Vec<Tier> = hops.iter().map(|hop| hop.tier).collect();
    assert_eq!(tiers, [Tier::Pro, Tier::Pro, Tier::Relay, Tier::Relay]);
}

#[test]
fn a_put_outside_our_zones_gets_no_route() {
    for url in [
        "https://evil.example.com/scd-chat/m/0a1b",
        "https://unknown.scnative.dev/x",
        "not a url",
    ] {
        assert!(media_plan_in(&inner(), url, Instant::now()).is_empty());
    }
}

#[test]
fn a_put_without_a_relay_pool_still_has_the_bootstrap_relay_and_pro_node() {
    let hops = media_plan_in(&Inner::default(), PUT, Instant::now());
    assert_eq!(
        shown(&hops),
        [
            (
                Tier::Relay,
                "https://s3.r1.relay.scnative.dev/scd-chat/m/0a1b?X-Amz-Signature=ab%2Fcd&X-Amz-Expires=600"
            ),
            (Tier::Pro, "https://p1.pro.scnative.dev"),
        ]
    );
}

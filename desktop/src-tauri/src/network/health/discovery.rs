use std::future::Future;

use uuid::Uuid;

use crate::network::edge;

pub const MAX_INDEX: usize = 16;
const STOP_AFTER_MISSES: usize = 2;
const ORIGIN_ZONE: &str = "scnative.space";

pub async fn relays(known: &[String]) -> Vec<String> {
    let zone = edge::relay_zone();
    let found = scan(
        known,
        |index| format!("r{index}"),
        move |node| format!("{node}.{zone}"),
        resolves,
    )
    .await;
    merge(known.to_vec(), found)
}

pub async fn calls(known: &[String]) -> Vec<String> {
    let found = scan(
        known,
        |index| format!("call-{index}"),
        |node| format!("{node}.{ORIGIN_ZONE}"),
        resolves,
    )
    .await;
    merge(known.to_vec(), found)
}

async fn scan<Name, Host, Lookup, Fut>(
    known: &[String],
    name: Name,
    host: Host,
    lookup: Lookup,
) -> Vec<String>
where
    Name: Fn(usize) -> String,
    Host: Fn(&str) -> String,
    Lookup: Fn(String) -> Fut,
    Fut: Future<Output = bool>,
{
    let nonexistent = format!("nx-{}", Uuid::new_v4().simple());
    if lookup(host(&nonexistent)).await {
        return Vec::new();
    }
    walk(next_index(known), name, |node| lookup(host(node))).await
}

pub fn next_index(known: &[String]) -> usize {
    known
        .iter()
        .filter_map(|node| {
            node.trim_start_matches(|c: char| !c.is_ascii_digit())
                .parse()
                .ok()
        })
        .max()
        .map(|last: usize| last + 1)
        .unwrap_or(1)
}

pub async fn walk<Name, Probe, Fut>(start: usize, name: Name, probe: Probe) -> Vec<String>
where
    Name: Fn(usize) -> String,
    Probe: Fn(&str) -> Fut,
    Fut: Future<Output = bool>,
{
    let mut found = Vec::new();
    let mut misses = 0;
    for index in start..=MAX_INDEX {
        let node = name(index);
        if probe(&node).await {
            found.push(node);
            misses = 0;
        } else {
            misses += 1;
            if misses >= STOP_AFTER_MISSES {
                break;
            }
        }
    }
    found
}

async fn resolves(host: String) -> bool {
    tokio::net::lookup_host((host.as_str(), 443))
        .await
        .map(|mut addrs| addrs.next().is_some())
        .unwrap_or(false)
}

pub fn merge(from_topology: Vec<String>, discovered: Vec<String>) -> Vec<String> {
    let mut pool = from_topology;
    for node in discovered {
        if !pool.contains(&node) {
            pool.push(node);
        }
    }
    pool
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn from(start: usize, live: &[&str]) -> Vec<String> {
        walk(start, |index| format!("r{index}"), |node| {
            let alive = live.contains(&node);
            async move { alive }
        })
        .await
    }

    #[tokio::test]
    async fn two_misses_in_a_row_end_the_pool() {
        assert_eq!(from(1, &["r1", "r2", "r3"]).await, ["r1", "r2", "r3"]);
    }

    #[tokio::test]
    async fn a_single_hole_in_the_middle_is_survived() {
        assert_eq!(from(1, &["r1", "r3", "r4"]).await, ["r1", "r3", "r4"]);
    }

    #[tokio::test]
    async fn a_node_raised_before_the_topology_caught_up_is_still_found() {
        assert_eq!(from(3, &["r3"]).await, ["r3"]);
    }

    #[tokio::test]
    async fn a_pool_that_is_already_complete_costs_two_lookups() {
        assert!(from(3, &["r1", "r2"]).await.is_empty());
    }

    #[tokio::test]
    async fn dns_that_answers_every_name_adds_no_nodes() {
        let found = scan(
            &["r1".to_string()],
            |index| format!("r{index}"),
            |node| format!("{node}.relay.scnative.space"),
            |_| async { true },
        )
        .await;
        assert!(found.is_empty());
    }

    #[tokio::test]
    async fn real_dns_still_finds_the_new_node() {
        let found = scan(
            &["r1".to_string()],
            |index| format!("r{index}"),
            |node| format!("{node}.relay.scnative.space"),
            |host| async move { host == "r2.relay.scnative.space" },
        )
        .await;
        assert_eq!(found, ["r2"]);
    }

    #[test]
    fn scanning_resumes_after_the_nodes_topology_already_named() {
        assert_eq!(next_index(&[]), 1);
        assert_eq!(next_index(&["r1".into(), "r2".into()]), 3);
        assert_eq!(next_index(&["call-1".into(), "call-3".into()]), 4);
    }

    #[test]
    fn topology_wins_and_discovery_only_adds() {
        assert_eq!(
            merge(vec!["r1".into(), "r2".into()], vec!["r2".into(), "r5".into()]),
            ["r1", "r2", "r5"]
        );
    }
}

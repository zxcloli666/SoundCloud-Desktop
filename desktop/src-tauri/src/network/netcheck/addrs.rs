use std::net::IpAddr;
use std::time::Duration;

use futures_util::future::join_all;

use super::model::{DnsState, TargetCheck};
use crate::network::dns::{self, doh};
use crate::network::edge;

const LOOKUP_BUDGET: Duration = Duration::from_secs(4);
const MAX_ADDRS: usize = 16;

pub async fn known(checked: Vec<String>) -> Vec<IpAddr> {
    let hosts: Vec<String> = edge::zone_hosts()
        .into_iter()
        .filter(|host| !checked.contains(host))
        .collect();
    let answers = join_all(hosts.iter().map(|host| resolve(host))).await;
    answers.into_iter().flatten().collect()
}

async fn resolve(host: &str) -> Vec<IpAddr> {
    if let Ok(Ok(answer)) = tokio::time::timeout(LOOKUP_BUDGET, doh::query(host)).await
        && !answer.addrs.is_empty()
    {
        return answer.addrs;
    }
    tokio::time::timeout(LOOKUP_BUDGET, dns::lookup(host))
        .await
        .ok()
        .and_then(Result::ok)
        .unwrap_or_default()
}

pub fn ours(targets: &[TargetCheck], known: Vec<IpAddr>) -> Vec<IpAddr> {
    let confirmed: Vec<IpAddr> = targets
        .iter()
        .filter_map(|target| target.doh.as_ref())
        .flat_map(|doh| doh.addrs.iter().copied())
        .collect();
    let lies: Vec<IpAddr> = targets
        .iter()
        .filter(|target| matches!(target.dns, DnsState::Spoofed | DnsState::Garbage))
        .flat_map(|target| target.system.addrs.iter().copied())
        .filter(|addr| !confirmed.contains(addr))
        .collect();
    let mut found: Vec<IpAddr> = Vec::new();
    for addr in targets.iter().flat_map(trusted).chain(known) {
        if found.len() < MAX_ADDRS
            && public(addr)
            && !lies.contains(&addr)
            && !found.contains(&addr)
        {
            found.push(addr);
        }
    }
    found
}

fn public(addr: IpAddr) -> bool {
    !dns::garbage(addr) && !dns::tunnelled(addr)
}

fn trusted(target: &TargetCheck) -> Vec<IpAddr> {
    match &target.doh {
        Some(doh) if !doh.addrs.is_empty() => doh.addrs.clone(),
        _ if target.dns == DnsState::Sane => target.system.addrs.clone(),
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::network::netcheck::model::{DnsAnswer, TargetId};

    fn ip(text: &str) -> IpAddr {
        text.parse().unwrap()
    }

    fn answer(addrs: &[&str]) -> DnsAnswer {
        DnsAnswer {
            addrs: addrs.iter().map(|addr| ip(addr)).collect(),
            ..DnsAnswer::default()
        }
    }

    fn target(host: &str, dns: DnsState, system: &[&str], doh: Option<&[&str]>) -> TargetCheck {
        TargetCheck {
            system: answer(system),
            doh: doh.map(answer),
            dns,
            ..TargetCheck::pending(TargetId::Main, None, host.to_string())
        }
    }

    #[test]
    fn our_addresses_come_from_doh_or_a_sane_system_answer() {
        let targets = [
            target(
                "api.scnative.space",
                DnsState::Spoofed,
                &["5.45.192.1"],
                Some(&["188.165.221.195"]),
            ),
            target(
                "api-star.scnative.space",
                DnsState::Sane,
                &["192.95.29.82"],
                None,
            ),
            target(
                "storage.scnative.space",
                DnsState::Sane,
                &["188.165.221.195"],
                Some(&["188.165.221.195"]),
            ),
            target(
                "images.scnative.space",
                DnsState::Garbage,
                &["10.10.34.35"],
                Some(&[]),
            ),
        ];
        let found = ours(&targets, vec![ip("192.99.8.79"), ip("192.95.29.82")]);
        assert_eq!(
            found,
            vec![ip("188.165.221.195"), ip("192.95.29.82"), ip("192.99.8.79")]
        );
    }

    #[test]
    fn private_fake_and_spoofed_addresses_are_never_offered() {
        let targets = [
            target(
                "api.scnative.space",
                DnsState::Spoofed,
                &["5.45.192.1"],
                Some(&["188.165.221.195"]),
            ),
            target(
                "api-star.scnative.space",
                DnsState::Sane,
                &["10.0.0.5", "192.95.29.82", "198.18.0.7"],
                None,
            ),
        ];
        let known = vec![
            ip("5.45.192.1"),
            ip("100.64.3.4"),
            ip("127.0.0.1"),
            ip("192.99.8.79"),
        ];
        assert_eq!(
            ours(&targets, known),
            vec![ip("188.165.221.195"), ip("192.95.29.82"), ip("192.99.8.79")]
        );
    }

    #[test]
    fn a_spoofed_answer_that_doh_confirms_elsewhere_stays() {
        let targets = [
            target(
                "api.scnative.space",
                DnsState::Spoofed,
                &["192.95.29.82"],
                Some(&["188.165.221.195"]),
            ),
            target(
                "api-star.scnative.space",
                DnsState::Sane,
                &["192.95.29.82"],
                Some(&["192.95.29.82"]),
            ),
        ];
        assert_eq!(
            ours(&targets, Vec::new()),
            vec![ip("188.165.221.195"), ip("192.95.29.82")]
        );
    }

    #[test]
    fn the_list_stays_short() {
        let known = (0..40).map(|n| IpAddr::from([2, 27, 22, n])).collect();
        assert_eq!(ours(&[], known).len(), MAX_ADDRS);
    }
}

use std::net::{IpAddr, Ipv4Addr};

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;

const TYPE_A: u16 = 1;
const CLASS_IN: u16 = 1;
const MAX_ANSWERS: usize = 64;
const MAX_LABELS: usize = 128;

pub const RCODE_OK: u8 = 0;
pub const RCODE_NXDOMAIN: u8 = 3;

pub const SINKHOLES: [IpAddr; 1] = [IpAddr::V4(Ipv4Addr::new(2, 26, 93, 81))];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Answer {
    pub rcode: u8,
    pub addrs: Vec<IpAddr>,
    pub ttl: u32,
}

pub fn build_query(name: &str) -> Option<Vec<u8>> {
    let mut out = vec![0, 0, 0x01, 0x00, 0, 1, 0, 0, 0, 0, 0, 0];
    for label in name.trim_end_matches('.').split('.') {
        if label.is_empty() || label.len() > 63 || !label.is_ascii() {
            return None;
        }
        out.push(label.len() as u8);
        out.extend_from_slice(label.as_bytes());
    }
    out.push(0);
    out.extend_from_slice(&TYPE_A.to_be_bytes());
    out.extend_from_slice(&CLASS_IN.to_be_bytes());
    (out.len() <= 512).then_some(out)
}

pub fn query_url(endpoint: &str, query: &[u8]) -> String {
    format!("{endpoint}?dns={}", URL_SAFE_NO_PAD.encode(query))
}

fn skip_name(buf: &[u8], mut at: usize) -> Option<usize> {
    for _ in 0..MAX_LABELS {
        let len = *buf.get(at)? as usize;
        match len {
            0 => return Some(at + 1),
            pointer if pointer & 0xC0 == 0xC0 => {
                buf.get(at + 1)?;
                return Some(at + 2);
            }
            reserved if reserved & 0xC0 != 0 => return None,
            label => at += 1 + label,
        }
    }
    None
}

fn be16(buf: &[u8], at: usize) -> Option<u16> {
    Some(u16::from_be_bytes([*buf.get(at)?, *buf.get(at + 1)?]))
}

fn be32(buf: &[u8], at: usize) -> Option<u32> {
    Some(u32::from_be_bytes(buf.get(at..at + 4)?.try_into().ok()?))
}

pub fn parse_response(buf: &[u8]) -> Option<Answer> {
    let flags = be16(buf, 2)?;
    if flags & 0x8000 == 0 {
        return None;
    }
    let rcode = (flags & 0x000F) as u8;
    let questions = be16(buf, 4)? as usize;
    let answers = be16(buf, 6)? as usize;
    let mut at = 12;
    for _ in 0..questions {
        at = skip_name(buf, at)? + 4;
    }
    let mut addrs = Vec::new();
    let mut ttl = u32::MAX;
    for _ in 0..answers.min(MAX_ANSWERS) {
        at = skip_name(buf, at)?;
        let kind = be16(buf, at)?;
        let record_ttl = be32(buf, at + 4)?;
        let len = be16(buf, at + 8)? as usize;
        let data = buf.get(at + 10..at + 10 + len)?;
        at += 10 + len;
        if kind != TYPE_A || len != 4 {
            continue;
        }
        addrs.push(IpAddr::V4(Ipv4Addr::new(
            data[0], data[1], data[2], data[3],
        )));
        ttl = ttl.min(record_ttl);
    }
    Some(Answer {
        rcode,
        addrs,
        ttl: if ttl == u32::MAX { 0 } else { ttl },
    })
}

pub fn bogus(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            let [a, b, c, _] = v4.octets();
            v4.is_unspecified()
                || v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                || v4.is_multicast()
                || v4.is_broadcast()
                || a == 0
                || a >= 240
                || (a == 192 && b == 0 && c == 2)
                || (a == 198 && b == 51 && c == 100)
                || (a == 203 && b == 0 && c == 113)
        }
        IpAddr::V6(v6) => {
            let first = v6.segments()[0];
            v6.is_unspecified()
                || v6.is_loopback()
                || v6.is_multicast()
                || first & 0xFE00 == 0xFC00
                || first & 0xFFC0 == 0xFE80
                || v6.to_ipv4_mapped().is_some_and(|v4| bogus(IpAddr::V4(v4)))
        }
    }
}

pub fn garbage(ip: IpAddr) -> bool {
    bogus(ip) || SINKHOLES.contains(&ip)
}

pub fn tunnelled(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            let [a, b, _, _] = v4.octets();
            (a == 198 && (b == 18 || b == 19)) || (a == 100 && (64..128).contains(&b))
        }
        IpAddr::V6(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use std::net::IpAddr;

    use super::{
        Answer, RCODE_NXDOMAIN, TYPE_A, bogus, build_query, garbage, parse_response, query_url,
        tunnelled,
    };

    const TYPE_CNAME: u16 = 5;

    fn response(rcode: u8, answers: &[(u16, u32, &[u8])]) -> Vec<u8> {
        let mut wire = build_query("api.scnative.space").unwrap();
        wire[2] = 0x81;
        wire[3] = 0x80 | rcode;
        wire[7] = answers.len() as u8;
        for (kind, ttl, data) in answers {
            wire.extend_from_slice(&[0xC0, 0x0C]);
            wire.extend_from_slice(&kind.to_be_bytes());
            wire.extend_from_slice(&1u16.to_be_bytes());
            wire.extend_from_slice(&ttl.to_be_bytes());
            wire.extend_from_slice(&(data.len() as u16).to_be_bytes());
            wire.extend_from_slice(data);
        }
        wire
    }

    fn ip(text: &str) -> IpAddr {
        text.parse().unwrap()
    }

    #[test]
    fn a_query_follows_the_rfc_1035_layout() {
        let query = build_query("api.scnative.space").unwrap();
        assert_eq!(&query[..12], &[0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
        assert_eq!(&query[12..16], &[3, b'a', b'p', b'i']);
        assert_eq!(&query[query.len() - 5..], &[0, 0, 1, 0, 1]);
        assert_eq!(build_query("api.scnative.space."), Some(query));
        assert!(build_query("bad..name").is_none());
        assert!(build_query(&"a".repeat(64)).is_none());
        assert!(build_query("пример.рф").is_none());
    }

    #[test]
    fn the_get_url_carries_unpadded_base64url() {
        let query = build_query("a.b").unwrap();
        let url = query_url("https://x/dns-query", &query);
        let encoded = url.strip_prefix("https://x/dns-query?dns=").unwrap();
        assert_eq!(encoded, "AAABAAABAAAAAAAAAWEBYgAAAQAB");
        assert!(!encoded.contains(['=', '+', '/']));
    }

    #[test]
    fn compressed_answers_behind_a_cname_are_parsed() {
        let cname = [3, b'f', b'o', b'o', 0];
        let wire = response(
            0,
            &[
                (TYPE_CNAME, 300, &cname),
                (TYPE_A, 60, &[188, 165, 221, 195]),
                (TYPE_A, 30, &[1, 2, 3, 4]),
            ],
        );
        let answer = parse_response(&wire).unwrap();
        assert_eq!(
            answer,
            Answer {
                rcode: 0,
                addrs: vec![ip("188.165.221.195"), ip("1.2.3.4")],
                ttl: 30,
            }
        );
    }

    #[test]
    fn nxdomain_has_rcode_3_and_no_addresses() {
        let answer = parse_response(&response(RCODE_NXDOMAIN, &[])).unwrap();
        assert_eq!((answer.rcode, answer.addrs.len()), (RCODE_NXDOMAIN, 0));
    }

    #[test]
    fn a_captured_cloudflare_answer_parses() {
        let mut wire = vec![0x00, 0x00, 0x81, 0x80, 0, 1, 0, 1, 0, 0, 0, 0];
        for label in ["api", "scnative", "space"] {
            wire.push(label.len() as u8);
            wire.extend_from_slice(label.as_bytes());
        }
        wire.extend_from_slice(&[0, 0, 1, 0, 1, 0xC0, 0x0C, 0, 1, 0, 1, 0, 0, 0, 60, 0, 4]);
        wire.extend_from_slice(&[188, 165, 221, 195]);
        let answer = parse_response(&wire).unwrap();
        assert_eq!(answer.addrs, [ip("188.165.221.195")]);
        assert_eq!((answer.rcode, answer.ttl), (0, 60));
    }

    #[test]
    fn an_echoed_query_is_not_a_response() {
        assert!(parse_response(&build_query("a.b").unwrap()).is_none());
    }

    #[test]
    fn truncated_and_mutated_answers_never_panic() {
        let wire = response(0, &[(TYPE_A, 60, &[1, 2, 3, 4])]);
        for cut in 0..wire.len() {
            let _ = parse_response(&wire[..cut]);
        }
        let mut seed = 0x9E37_79B9_7F4A_7C15u64;
        for _ in 0..20_000 {
            let mut buf = wire.clone();
            for _ in 0..4 {
                seed = seed
                    .wrapping_mul(6_364_136_223_846_793_005)
                    .wrapping_add(1_442_695_040_888_963_407);
                let at = (seed >> 33) as usize % buf.len();
                buf[at] = (seed >> 24) as u8;
            }
            let _ = parse_response(&buf);
        }
        let mut looped = response(0, &[]);
        looped[12] = 0xC0;
        looped[13] = 0x0C;
        let _ = parse_response(&looped);
    }

    #[test]
    fn reserved_ranges_are_bogus() {
        for text in [
            "0.0.0.0",
            "127.0.0.1",
            "10.1.2.3",
            "192.168.0.1",
            "172.16.0.9",
            "169.254.1.1",
            "203.0.113.113",
            "240.0.0.1",
            "::",
            "::1",
            "fe80::1",
            "fc00::5",
            "::ffff:10.0.0.1",
        ] {
            assert!(bogus(ip(text)), "{text}");
        }
        for text in ["198.18.0.5", "100.64.0.1", "188.165.221.195", "8.8.8.8"] {
            assert!(!bogus(ip(text)), "{text}");
        }
    }

    #[test]
    fn a_known_sinkhole_is_garbage_though_not_reserved() {
        assert!(!bogus(ip("2.26.93.81")));
        assert!(garbage(ip("2.26.93.81")));
        assert!(!garbage(ip("2.26.99.107")));
    }

    #[test]
    fn fake_ip_tunnels_and_cgnat_are_recognised() {
        for text in ["198.18.0.5", "198.19.255.1", "100.64.0.1", "100.127.3.4"] {
            assert!(tunnelled(ip(text)), "{text}");
        }
        for text in ["198.20.0.1", "100.128.0.1", "188.165.221.195", "::1"] {
            assert!(!tunnelled(ip(text)), "{text}");
        }
    }
}

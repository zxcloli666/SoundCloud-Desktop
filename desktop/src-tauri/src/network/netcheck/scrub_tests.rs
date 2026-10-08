use std::net::IpAddr;

use super::{capped, env, mask_users, resolver, scrub, scrub_with, value};
use crate::network::netcheck::model::EnvInfo;

fn ip(text: &str) -> IpAddr {
    text.parse().unwrap()
}

#[test]
fn v6_resolvers_keep_only_their_network() {
    let table = [
        ("192.168.1.1", "192.168.1.1"),
        ("2a02:6b8:0:1::feed", "2a02:6b8::"),
        ("2001:4860:4860::8888", "2001:4860::"),
        ("fe80::1a2b:3cff:fe4d:5e6f", "fe80::"),
        ("fd12:3456:789a::1", "fd00::"),
        ("::ffff:10.0.0.1", "10.0.0.1"),
    ];
    for (raw, shown) in table {
        assert_eq!(resolver(ip(raw)), ip(shown), "{raw}");
    }
}

#[test]
fn vpn_names_are_scrubbed_short_and_few() {
    let mut info = EnvInfo {
        vpn: vec![
            "WireGuard Tunnel: C:\\Users\\Ivan\\home.conf and a very long tail".to_string(),
            "wg1".to_string(),
            "tun0".to_string(),
            "utun3".to_string(),
        ],
        dns_servers: vec![ip("2a02:6b8:0:1::1"), ip("1.1.1.1"), ip("2a02:6b8:0:2::1")],
        ..EnvInfo::default()
    };
    env(&mut info);
    assert_eq!(info.vpn.len(), 3);
    assert!(info.vpn.iter().all(|name| name.chars().count() <= 32));
    assert!(!info.vpn[0].contains("Ivan"), "{}", info.vpn[0]);
    assert_eq!(info.dns_servers, vec![ip("2a02:6b8::"), ip("1.1.1.1")]);
}

#[test]
fn user_folders_lose_the_user_name() {
    assert_eq!(
        mask_users("\"C:\\Users\\Ivan Petrov\\zapret\\winws.exe\" --wf-tcp=443"),
        "\"C:\\Users\\~\\zapret\\winws.exe\" --wf-tcp=443"
    );
    assert_eq!(mask_users("C:\\users\\ivan\\bin"), "C:\\users\\~\\bin");
    assert_eq!(
        mask_users("/home/ivan/zapret/nfqws --x"),
        "/home/~/zapret/nfqws --x"
    );
    assert_eq!(mask_users("cd /home/ivan --flag"), "cd /home/~ --flag");
    assert_eq!(mask_users("/Users/ivan/Library"), "/Users/~/Library");
    assert_eq!(mask_users("/home/"), "/home/");
    assert_eq!(mask_users("/opt/zapret/config"), "/opt/zapret/config");
}

#[test]
fn the_home_folder_becomes_a_tilde() {
    let Some(home) = dirs::home_dir() else { return };
    let path = home.join("zapret").to_string_lossy().into_owned();
    assert!(scrub(&path).starts_with('~'), "{}", scrub(&path));
}

#[test]
fn secrets_are_redacted() {
    let text = scrub(
        "GET https://api.scnative.space/me?session_id=abc123 Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.x",
    );
    assert!(!text.contains("abc123"), "{text}");
    assert!(!text.contains("eyJhbGciOiJIUzI1NiJ9"), "{text}");
}

#[test]
fn proxy_credentials_are_masked() {
    assert_eq!(
        scrub("proxy http://ivan:secret@10.0.0.1:3128/ failed"),
        "proxy http://***@10.0.0.1:3128/ failed"
    );
    assert_eq!(
        scrub("https://api.scnative.space/health"),
        "https://api.scnative.space/health"
    );
    assert_eq!(scrub("socks5://u@h"), "socks5://***@h");
}

#[test]
fn values_are_capped() {
    assert_eq!(capped(&"x".repeat(5000)).len(), 2048);
    assert_eq!(value(&"y".repeat(3000)).len(), 2048);
}

#[test]
fn only_the_whole_home_folder_becomes_a_tilde() {
    let home = Some("/home/ivan");
    assert_eq!(
        scrub_with("/home/ivanova/x and /home/ivan/y", home),
        "/home/~/x and ~/y"
    );
    assert_eq!(scrub_with("cd /home/ivan", home), "cd ~");
    assert_eq!(scrub_with("\"/home/ivan\" --x", home), "\"~\" --x");
    let windows = Some("C:\\Users\\Ivan");
    assert_eq!(
        scrub_with("C:\\Users\\Ivanova\\bin C:\\Users\\Ivan\\bin", windows),
        "C:\\Users\\~\\bin ~\\bin"
    );
}

#[test]
fn inline_host_and_ip_lists_become_counts() {
    let args = "--wf-tcp=443 --hostlist-domains=a.com,b.org,c.net --dpi-desync-fooling=badseq,ts \
                --ipset-ip=1.2.3.4,5.6.7.0/24 --hostlist-exclude-domains=\"x.ru\" --ipset-exclude-ip=";
    assert_eq!(
        scrub_with(args, None),
        "--wf-tcp=443 --hostlist-domains=<3 items> --dpi-desync-fooling=badseq,ts \
                --ipset-ip=<2 items> --hostlist-exclude-domains=\"<1 item>\" --ipset-exclude-ip=<0 items>"
    );
    assert_eq!(
        scrub_with("--hostlist=lists/list-general.txt", None),
        "--hostlist=lists/list-general.txt"
    );
}

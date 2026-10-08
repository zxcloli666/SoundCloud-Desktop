use std::net::IpAddr;

use super::{
    cmdline, distinct, hidepid, netsh_timestamps, parse_resolv_conf, parse_zapret_config,
    sysctl_timestamps, tool_for, uses_ts_fooling, vpn_like,
};
use crate::network::netcheck::model::DpiTool;

const ZAPRET_V1: &str = r#"
# this file is included from init scripts
#FWTYPE=iptables

# options for nfqws
NFQWS_ENABLE=0
NFQWS_PORTS_TCP=80,443
NFQWS_OPT="
--filter-tcp=80 --dpi-desync=fake,multisplit --dpi-desync-split-pos=method+2 --dpi-desync-fooling=md5sig <HOSTLIST> --new
--filter-tcp=443 --dpi-desync=fake,multidisorder --dpi-desync-split-pos=1,midsld --dpi-desync-fooling=badseq,md5sig <HOSTLIST> --new
--filter-udp=443 --dpi-desync=fake --dpi-desync-repeats=6 <HOSTLIST_NOAUTO>
"

# none,ipset,hostlist,autohostlist
MODE_FILTER=none
DISABLE_IPV6=1
"#;

const ZAPRET_V2: &str = r#"
NFQWS2_ENABLE=1
NFQWS2_OPT="
--filter-tcp=443 --filter-l7=tls <HOSTLIST> --payload=tls_client_hello --lua-desync=fake:blob=fake_default_tls:tcp_md5:tcp_seq=-10000 --lua-desync=multidisorder:pos=1,midsld --new
--filter-udp=443 --filter-l7=quic <HOSTLIST_NOAUTO> --payload=quic_initial --lua-desync=fake:blob=fake_default_quic:repeats=6
"
MODE_FILTER=ipset
"#;

const NETSH_EN: &str = "Querying active state...\r\n\r\nTCP Global Parameters\r\n----------------------------------------------\r\nReceive-Side Scaling State          : enabled\r\nReceive Window Auto-Tuning Level    : normal\r\nECN Capability                      : disabled\r\nRFC 1323 Timestamps                 : disabled\r\nInitial RTO                         : 1000\r\n";

#[test]
fn dpi_tools_match_by_process_name_only() {
    assert_eq!(tool_for("winws.exe"), Some("winws"));
    assert_eq!(tool_for("WINWS2.EXE"), Some("winws2"));
    assert_eq!(tool_for("GoodbyeDPI.exe"), Some("goodbyedpi"));
    assert_eq!(tool_for("nfqws\n"), Some("nfqws"));
    assert_eq!(tool_for("tpws"), Some("tpws"));
    assert_eq!(tool_for("firefox"), None);
    assert_eq!(tool_for("winwsx.exe"), None);
}

#[test]
fn nul_separated_arguments_are_joined_and_capped() {
    assert_eq!(
        cmdline(b"nfqws\0--qnum=200\0--dpi-desync=fake\0"),
        "nfqws --qnum=200 --dpi-desync=fake"
    );
    let long = [b'a'; 5000];
    assert_eq!(cmdline(&long).len(), 2048);
}

#[test]
fn the_stock_v1_config_yields_mode_and_multiline_options() {
    let config = parse_zapret_config(ZAPRET_V1);
    assert_eq!(config["MODE_FILTER"], "none");
    assert_eq!(config["NFQWS_ENABLE"], "0");
    assert_eq!(config["NFQWS_PORTS_TCP"], "80,443");
    assert_eq!(config["DISABLE_IPV6"], "1");
    assert!(config["NFQWS_OPT"].starts_with("--filter-tcp=80 --dpi-desync=fake,multisplit"));
    assert!(config["NFQWS_OPT"].contains("badseq,md5sig"));
    assert!(!config.contains_key("FWTYPE"));
}

#[test]
fn the_v2_config_uses_its_own_option_names() {
    let config = parse_zapret_config(ZAPRET_V2);
    assert_eq!(config["MODE_FILTER"], "ipset");
    assert!(config["NFQWS2_OPT"].contains("--lua-desync=multidisorder"));
    assert!(!config.contains_key("NFQWS_OPT"));
    assert!(!uses_ts_fooling(&config["NFQWS2_OPT"]));
}

#[test]
fn comments_trailing_text_and_unknown_keys_are_skipped() {
    let config = parse_zapret_config(
        "#MODE_FILTER=hostlist\nMODE_FILTER=ipset  # trailing\nFWTYPE=nftables\nSECRET=1\nNFQWS_OPT=\"--a --ts\"\n",
    );
    assert_eq!(config["MODE_FILTER"], "ipset");
    assert_eq!(config["FWTYPE"], "nftables");
    assert_eq!(config["NFQWS_OPT"], "--a --ts");
    assert!(!config.contains_key("SECRET"));
}

#[test]
fn an_unterminated_quote_ends_at_the_last_line() {
    let config = parse_zapret_config("NFQWS_OPT=\"--a\n--b");
    assert_eq!(config["NFQWS_OPT"], "--a --b");
}

#[test]
fn netsh_timestamps_are_read_from_english_output() {
    assert_eq!(
        netsh_timestamps(NETSH_EN.as_bytes()).as_deref(),
        Some("disabled")
    );
    let enabled = NETSH_EN.replace(": disabled\r\nInitial", ": enabled\r\nInitial");
    assert_eq!(
        netsh_timestamps(enabled.as_bytes()).as_deref(),
        Some("enabled")
    );
}

#[test]
fn oem_bytes_in_a_localized_label_do_not_break_the_parse() {
    let mut raw = b"ECN : disabled\r\n".to_vec();
    raw.extend_from_slice(&[0x8C, 0xA5, 0xE2, 0xAA, 0xA8, 0x20]);
    raw.extend_from_slice(b"RFC 1323                : enabled\r\n");
    assert_eq!(netsh_timestamps(&raw).as_deref(), Some("enabled"));
}

#[test]
fn a_localized_value_is_kept_raw() {
    assert_eq!(
        netsh_timestamps("RFC 1323 : aktiviert\r\n".as_bytes()).as_deref(),
        Some("aktiviert")
    );
    assert_eq!(netsh_timestamps(b"Access is denied.\r\n"), None);
}

#[test]
fn linux_sysctl_values_are_named() {
    assert_eq!(sysctl_timestamps("0\n").as_deref(), Some("disabled"));
    assert_eq!(sysctl_timestamps("1\n").as_deref(), Some("enabled"));
    assert_eq!(sysctl_timestamps("2").as_deref(), Some("enabled"));
    assert_eq!(sysctl_timestamps(""), None);
}

#[test]
fn resolv_conf_servers_include_scoped_v6() {
    let text = "# c\nnameserver 192.168.1.1\nnameserver fe80::1%eth0\nsearch lan\nnameserver  8.8.8.8 # x\n;nameserver 1.1.1.1\n";
    let expected: Vec<IpAddr> = ["192.168.1.1", "fe80::1", "8.8.8.8"]
        .iter()
        .map(|ip| ip.parse().unwrap())
        .collect();
    assert_eq!(parse_resolv_conf(text), expected);
}

#[test]
fn hidepid_is_found_only_on_the_proc_mount() {
    assert!(hidepid(
        "sysfs /sys sysfs rw 0 0\nproc /proc proc rw,nosuid,hidepid=2,gid=4 0 0\n"
    ));
    assert!(!hidepid("proc /proc proc rw,nosuid,nodev 0 0\n"));
    assert!(!hidepid("tmpfs /run tmpfs rw,hidepid=2 0 0\n"));
}

#[test]
fn vpn_interfaces_are_recognised_by_name() {
    for name in [
        "tun0",
        "wg0",
        "utun3",
        "Tailscale",
        "ProtonVPN",
        "Hiddify",
        "AmneziaWG",
        "Cloudflare WARP",
    ] {
        assert!(vpn_like(name), "{name}");
    }
    for name in ["eth0", "wlan0", "Ethernet", "Wi-Fi", "lo", "en0"] {
        assert!(!vpn_like(name), "{name}");
    }
}

#[test]
fn ts_fooling_is_found_in_both_syntaxes() {
    assert!(uses_ts_fooling(
        "--dpi-desync=fake --dpi-desync-fooling=badseq,ts"
    ));
    assert!(uses_ts_fooling("--dpi-desync-fooling=ts"));
    assert!(!uses_ts_fooling("--dpi-desync-fooling=md5sig"));
    assert!(!uses_ts_fooling("--dpi-desync-fooling=badseq,tsx"));
    assert!(uses_ts_fooling("--lua-desync=fake:blob=x:tcp_ts=-1000"));
    assert!(!uses_ts_fooling("--dpi-desync=fake,multidisorder"));
    assert!(!uses_ts_fooling("--lua-desync=fake:blob=x:tcp_seq=-10000"));
}

#[test]
fn repeated_dpi_processes_are_listed_once_and_few() {
    let tool = |name: &str, args: &str| DpiTool {
        name: name.to_string(),
        args: Some(args.to_string()),
    };
    let tools = vec![
        tool("nfqws", "--qnum=200"),
        tool("nfqws", "--qnum=200"),
        tool("nfqws", "--qnum=201"),
        tool("tpws", "--port=988"),
        tool("nfqws", "--qnum=202"),
        tool("nfqws", "--qnum=203"),
    ];
    let kept = distinct(tools);
    assert_eq!(kept.len(), 4);
    assert_eq!(kept[0], tool("nfqws", "--qnum=200"));
    assert_eq!(kept[1], tool("nfqws", "--qnum=201"));
    assert_eq!(kept[2], tool("tpws", "--port=988"));
}

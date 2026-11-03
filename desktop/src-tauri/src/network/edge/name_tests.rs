use super::name::{Key, SERVICES, key_of, key_of_host};
use super::{is_known_host, is_our_host, set_pool, zone_hosts};

#[test]
fn every_host_form_carries_its_label() {
    for host in [
        "stream-star.scnative.dev",
        "stream-star.scnative.space",
        "stream-star.r1.relay.scnative.dev",
        "stream-star.r7.relay.scnative.space",
        "stream-star.scdinternal.site",
        "stream-star.temp.scdinternal.site",
    ] {
        assert_eq!(key_of_host(host), Key::Service("stream-star"), "{host}");
    }
    assert_eq!(
        key_of("https://HEALTH.r2.relay.scnative.space/report"),
        Key::Service("health")
    );
}

#[test]
fn a_host_in_our_zones_without_a_known_label_is_unknown() {
    for host in [
        "nats-public.scnative.dev",
        "call-1.scnative.dev",
        "r1.relay.scnative.dev",
        "p1.pro.scnative.dev",
        "x.api.scnative.dev",
        "nope.r1.relay.scnative.space",
        "admin.temp.scdinternal.site",
    ] {
        assert_eq!(key_of_host(host), Key::Unknown(host.to_string()), "{host}");
    }
}

#[test]
fn a_host_outside_our_zones_is_foreign() {
    for host in [
        "api-v2.soundcloud.com",
        "evilscnative.dev",
        "api.scnative.dev.example",
        "scnative.dev",
        "status.getsoundcloud.app",
    ] {
        assert_eq!(key_of_host(host), Key::Foreign, "{host}");
    }
    assert_eq!(key_of("not a url"), Key::Foreign);
}

#[test]
fn no_label_carries_a_zone() {
    for label in SERVICES {
        assert!(!label.contains('.'), "label {label} must be a bare service");
    }
}

#[test]
fn relay_pro_call_and_images_names_are_known_to_the_resolver() {
    set_pool(vec!["r1".into(), "r7".into()], vec![("call-1".into(), 1.0)]);
    for host in [
        "api.r7.relay.scnative.dev",
        "health.r1.relay.scnative.dev",
        "r1.relay.scnative.dev",
        "p1.pro.scnative.dev",
        "call-1.scnative.dev",
        "images.scnative.dev",
        "status.getsoundcloud.app",
    ] {
        assert!(is_known_host(host), "{host}");
    }
    for host in [
        "api.scnative.dev",
        "s3.scnative.space",
        "health.scnative.dev",
        "images.scnative.space",
        "api.r9.relay.scnative.dev",
        "api.r1.relay.scnative.space",
        "nope.r1.relay.scnative.dev",
        "nx-1f2e.relay.scnative.dev",
        "relay.scnative.dev",
        "status.soundcloud-desktop.fun",
        "soundcloud.com",
    ] {
        assert!(!is_known_host(host), "{host}");
    }
    let hosts = zone_hosts();
    assert!(hosts.iter().all(|host| is_known_host(host)), "{hosts:?}");
    assert!(hosts.contains(&"stream-star.r7.relay.scnative.dev".to_string()));
}

#[test]
fn our_hosts_are_the_names_we_connect_to() {
    for host in [
        "api.r9.relay.scnative.dev",
        "r9.relay.scnative.dev",
        "p9.pro.scnative.dev",
        "images.scnative.dev",
    ] {
        assert!(is_our_host(host), "{host}");
    }
    for host in [
        "api.scnative.dev",
        "storage.scnative.space",
        "images.scnative.space",
        "relay.scnative.dev",
        "evilrelay.scnative.dev",
        "api.scdinternal.site",
        "i1.sndcdn.com",
    ] {
        assert!(!is_our_host(host), "{host}");
    }
}

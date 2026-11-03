pub const RELAY_ZONE: &str = "relay.scnative.dev";
pub const PRO_ZONE: &str = "pro.scnative.dev";
pub const IMAGES: &str = "images";

const ORIGIN_ZONE: &str = "scnative.dev";
const ZONES: [&str; 2] = ["scnative.dev", "scnative.space"];
const INTERNAL_ZONE: &str = "scdinternal.site";
const RELAY: &str = "relay";

pub const OUR_ZONES: [&str; 3] = [ZONES[0], ZONES[1], INTERNAL_ZONE];

pub const SERVICES: [&str; 10] = [
    "api",
    "api-star",
    "stream",
    "stream-star",
    IMAGES,
    "storage",
    "storage-star",
    "s3",
    "pay",
    "health",
];

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Key {
    Service(&'static str),
    Unknown(String),
    Foreign,
}

pub fn key_of(url: &str) -> Key {
    let Ok(parsed) = url::Url::parse(url) else {
        return Key::Foreign;
    };
    match parsed.host_str() {
        Some(host) => key_of_host(&host.to_ascii_lowercase()),
        None => Key::Foreign,
    }
}

pub fn key_of_host(host: &str) -> Key {
    let label = if let Some(rest) = under(host, INTERNAL_ZONE) {
        rest.split('.').next()
    } else if let Some(rest) = ZONES.into_iter().find_map(|zone| under(host, zone)) {
        match rest.split('.').collect::<Vec<_>>()[..] {
            [label] | [label, _, RELAY] => Some(label),
            _ => None,
        }
    } else {
        return Key::Foreign;
    };
    match SERVICES.into_iter().find(|service| Some(*service) == label) {
        Some(service) => Key::Service(service),
        None => Key::Unknown(host.to_string()),
    }
}

pub fn label_of(url: &str) -> Option<&'static str> {
    match key_of(url) {
        Key::Service(label) => Some(label),
        Key::Unknown(_) | Key::Foreign => None,
    }
}

fn under<'a>(host: &'a str, zone: &str) -> Option<&'a str> {
    host.strip_suffix(zone)?
        .strip_suffix('.')
        .filter(|rest| !rest.is_empty())
}

pub fn key_hosts(label: &str) -> impl Iterator<Item = String> {
    ZONES.into_iter().map(move |zone| format!("{label}.{zone}"))
}

pub fn has_direct(label: &str) -> bool {
    label == IMAGES
}

pub fn plain_host(label: &str) -> String {
    format!("{label}.{ORIGIN_ZONE}")
}

pub fn call_host(node: &str) -> String {
    format!("{node}.{ORIGIN_ZONE}")
}

pub fn relay_host(label: &str, node: &str) -> String {
    format!("{label}.{node}.{RELAY_ZONE}")
}

pub fn node_host(node: &str) -> String {
    format!("{node}.{RELAY_ZONE}")
}

pub fn pro_host(node: &str) -> String {
    format!("{node}.{PRO_ZONE}")
}

pub fn in_zone(host: &str, zone: &str) -> bool {
    host.strip_suffix(zone)
        .is_some_and(|rest| rest.len() > 1 && rest.ends_with('.'))
}

pub fn on_host(url: &str, host: &str) -> Option<String> {
    let mut url = url::Url::parse(url).ok()?;
    url.set_scheme("https").ok()?;
    url.set_host(Some(host)).ok()?;
    url.set_port(None).ok()?;
    Some(url.to_string())
}

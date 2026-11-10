use crate::network::edge;

pub const DISCORD_CLIENT_ID: &str = "1431978756687265872";

const LOCAL_HOSTS: [&str; 3] = ["localhost", "127.0.0.1", "tauri.localhost"];
const OUR_ZONES: [&str; 2] = ["scnative.dev", "scnative.space"];

pub fn is_domain_whitelisted(host: &str) -> bool {
    LOCAL_HOSTS.contains(&host) || host == edge::plain_host(edge::IMAGES)
}

pub fn is_image_upstream(url: &str) -> bool {
    let Ok(url) = url::Url::parse(url) else {
        return false;
    };
    let ours = url.host_str().is_some_and(|host| {
        OUR_ZONES
            .iter()
            .any(|zone| host.strip_suffix(zone) == Some("images."))
    });
    ours && url.scheme() == "https"
        && url.port().is_none()
        && url.username().is_empty()
        && url.password().is_none()
        && url.path() == "/"
        && url.query().is_none()
        && url.fragment().is_none()
}

pub const LASTFM_API_KEY: Option<&str> = option_env!("LASTFM_API_KEY");
pub const LASTFM_API_SECRET: Option<&str> = option_env!("LASTFM_API_SECRET");

#[cfg(test)]
mod tests {
    use super::{is_domain_whitelisted, is_image_upstream};

    #[test]
    fn only_local_hosts_and_images_skip_the_proxy() {
        for host in ["localhost", "tauri.localhost", "images.scnative.dev"] {
            assert!(is_domain_whitelisted(host), "{host}");
        }
        for host in [
            "api.scnative.dev",
            "storage-star.scnative.dev",
            "storage.scnative.space",
            "images.scnative.space",
            "s3.scnative.dev",
            "scnative.dev",
            "api.scnative.dev.example",
            "api.r1.relay.scnative.dev",
            "i1.sndcdn.com",
        ] {
            assert!(!is_domain_whitelisted(host), "{host}");
        }
    }

    #[test]
    fn only_our_images_service_is_an_upstream() {
        for url in [
            "https://images.scnative.dev",
            "https://images.scnative.dev/",
            "https://images.scnative.space",
        ] {
            assert!(is_image_upstream(url), "{url}");
        }
        for url in [
            "http://images.scnative.dev",
            "https://images.scnative.dev:8443",
            "https://images.scnative.dev/x-target/aGk=",
            "https://images.scnative.dev/?a=1",
            "https://user@images.scnative.dev",
            "https://api.scnative.dev",
            "https://images.scnative.dev.example",
            "https://evil-images.scnative.dev",
            "https://images.r1.relay.scnative.dev",
            "http://127.0.0.1:9000",
            "http://169.254.169.254/latest",
            "https://i1.sndcdn.com",
            "images.scnative.dev",
            "",
        ] {
            assert!(!is_image_upstream(url), "{url}");
        }
    }
}

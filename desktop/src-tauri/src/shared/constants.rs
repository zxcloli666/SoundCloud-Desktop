use crate::network::edge;

pub const DISCORD_CLIENT_ID: &str = "1431978756687265872";

const LOCAL_HOSTS: [&str; 3] = ["localhost", "127.0.0.1", "tauri.localhost"];

pub fn is_domain_whitelisted(host: &str) -> bool {
    LOCAL_HOSTS.contains(&host) || host == edge::plain_host(edge::IMAGES)
}

pub const LASTFM_API_KEY: Option<&str> = option_env!("LASTFM_API_KEY");
pub const LASTFM_API_SECRET: Option<&str> = option_env!("LASTFM_API_SECRET");

#[cfg(test)]
mod tests {
    use super::is_domain_whitelisted;

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
}

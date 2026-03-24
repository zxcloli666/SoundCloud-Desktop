pub const DISCORD_CLIENT_ID: &str = "1431978756687265872";

pub const PROXY_URL: &str = if let Some(url) = option_env!("PROXY_URL") {
    url
} else {
    "https://images.soundcloud.su"
};
pub const DOMAIN_WHITELIST: &[&str] = &[
    "localhost",
    "127.0.0.1",
    "tauri.localhost",
    "api.soundcloud.su",
    "images.soundcloud.su",
];

pub fn is_domain_whitelisted(host: &str) -> bool {
    DOMAIN_WHITELIST.iter().any(|&w| host == w)
}

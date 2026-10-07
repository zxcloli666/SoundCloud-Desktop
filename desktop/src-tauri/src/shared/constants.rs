pub const DISCORD_CLIENT_ID: &str = "1431978756687265872";

pub const DOMAIN_WHITELIST: &[&str] = &[
    "localhost",
    "127.0.0.1",
    "tauri.localhost",
    "api.scnative.space",
    "images.scnative.space",
    "storage.scnative.space",
    "stream.scnative.space",
    "api-star.scnative.space",
    "stream-star.scnative.space",
    "storage-star.scnative.space",
    "pay.scnative.space",
];

pub fn is_domain_whitelisted(host: &str) -> bool {
    DOMAIN_WHITELIST.contains(&host)
}

pub const LASTFM_API_KEY: Option<&str> = option_env!("LASTFM_API_KEY");
pub const LASTFM_API_SECRET: Option<&str> = option_env!("LASTFM_API_SECRET");

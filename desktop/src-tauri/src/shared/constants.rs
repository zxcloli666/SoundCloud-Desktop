pub const DISCORD_CLIENT_ID: &str = "1431978756687265872";

pub fn is_domain_whitelisted(host: &str) -> bool {
    matches!(host, "localhost" | "127.0.0.1" | "tauri.localhost")
        || crate::network::backend::backend_hosts()
            .iter()
            .any(|backend| backend == host)
}

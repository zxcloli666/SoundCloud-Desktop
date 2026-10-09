use std::path::PathBuf;

pub struct ServerState {
    pub static_port: u16,
    pub proxy_port: u16,
}

#[tauri::command]
pub fn get_server_ports(state: tauri::State<'_, std::sync::Arc<ServerState>>) -> (u16, u16) {
    (state.static_port, state.proxy_port)
}

pub fn cors() -> warp::cors::Builder {
    warp::cors()
        .allow_any_origin()
        .allow_methods(vec![
            "GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS",
        ])
        .allow_headers(vec![
            "range",
            "content-type",
            "accept",
            "authorization",
            "accept-encoding",
        ])
        .expose_headers(vec!["content-range", "content-length", "accept-ranges"])
}

pub async fn start_all(wallpapers_dir: PathBuf, local_covers_dir: PathBuf) -> (u16, u16) {
    let static_port =
        crate::network::static_server::start(wallpapers_dir, local_covers_dir).await;
    let proxy_port = crate::network::proxy_server::start().await;
    (static_port, proxy_port)
}

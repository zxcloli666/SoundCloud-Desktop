use crate::rt::AppHandle;

pub const SCHEME: &str = "chatmedia";

pub async fn handle(_app: &AppHandle, _request: http::Request<Vec<u8>>) -> http::Response<Vec<u8>> {
    http::Response::builder()
        .status(http::StatusCode::SERVICE_UNAVAILABLE)
        .header("content-type", "text/plain")
        .header("cache-control", "no-store")
        .body(b"not available yet".to_vec())
        .unwrap()
}

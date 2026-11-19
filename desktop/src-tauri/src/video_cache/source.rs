use url::Url;

use crate::network::edge;

const STORAGE: [&str; 2] = ["storage", "storage-star"];
const PREFIX: &str = "/video/";

pub fn checked(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw).map_err(|_| "video url: not a url".to_string())?;
    if url.scheme() != "https" {
        return Err("video url: not https".into());
    }
    if url.port().is_some() || !url.username().is_empty() || url.password().is_some() {
        return Err("video url: port or login".into());
    }
    if url.query().is_some() || url.fragment().is_some() {
        return Err("video url: query".into());
    }
    if !edge::label_of(raw).is_some_and(|label| STORAGE.contains(&label)) {
        return Err("video url: not our storage".into());
    }
    let name = url.path().strip_prefix(PREFIX).unwrap_or_default();
    if name.is_empty() || name.contains('/') {
        return Err("video url: not a video path".into());
    }
    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::checked;

    #[test]
    fn a_storage_video_passes() {
        assert!(checked("https://storage.scnative.dev/video/123-1.mp4").is_ok());
        assert!(checked("https://storage-star.scnative.dev/video/123-2.mp4").is_ok());
    }

    #[test]
    fn a_foreign_host_is_refused() {
        assert!(checked("https://evil.example/video/1-1.mp4").is_err());
        assert!(checked("https://api.scnative.dev/video/1-1.mp4").is_err());
        assert!(checked("https://storage.scnative.dev.evil.example/video/1-1.mp4").is_err());
    }

    #[test]
    fn plain_http_is_refused() {
        assert!(checked("http://storage.scnative.dev/video/1-1.mp4").is_err());
    }

    #[test]
    fn a_port_or_login_is_refused() {
        assert!(checked("https://storage.scnative.dev:8443/video/1-1.mp4").is_err());
        assert!(checked("https://user:pass@storage.scnative.dev/video/1-1.mp4").is_err());
    }

    #[test]
    fn a_path_outside_video_is_refused() {
        assert!(checked("https://storage.scnative.dev/audio/1.mp3").is_err());
        assert!(checked("https://storage.scnative.dev/video/").is_err());
        assert!(checked("https://storage.scnative.dev/video/a/b.mp4").is_err());
        assert!(checked("https://storage.scnative.dev/video/../audio/1.mp3").is_err());
        assert!(checked("https://storage.scnative.dev/video/1-1.mp4?x=1").is_err());
    }
}

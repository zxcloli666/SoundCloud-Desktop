use base64::Engine as _;
use base64::engine::general_purpose::STANDARD;
use tauri::Url;

const MIRROR_PREFIX: &str = "/x-target/";

pub fn origin_of(url: &Url) -> Option<Url> {
    let encoded = url.path().strip_prefix(MIRROR_PREFIX)?;
    let decoded = STANDARD.decode(encoded).ok()?;
    Url::parse(std::str::from_utf8(&decoded).ok()?).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_the_mirrored_github_url() {
        let origin = "https://github.com/zxcloli666/SoundCloud-Desktop/releases/latest/download/app_1.0.0_x64-setup.exe";
        let mirrored = Url::parse(&format!(
            "https://images.scnative.space/x-target/{}",
            STANDARD.encode(origin)
        ))
        .unwrap();
        assert_eq!(origin_of(&mirrored).unwrap().as_str(), origin);
    }

    #[test]
    fn plain_urls_have_no_origin() {
        let url =
            Url::parse("https://github.com/a/b/releases/latest/download/latest.json").unwrap();
        assert!(origin_of(&url).is_none());
    }
}

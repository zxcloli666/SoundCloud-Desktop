use std::path::{Path, PathBuf};

use chrono::Local;

pub fn write(dir: &Path, bytes: &[u8]) -> Result<PathBuf, String> {
    std::fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    let name = format!(
        "scd-diagnostics-{}.json",
        Local::now().format("%Y%m%d-%H%M")
    );
    let path = dir.join(name);
    std::fs::write(&path, bytes).map_err(|error| error.to_string())?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::write;

    #[test]
    fn the_file_is_named_by_minute_and_holds_the_bytes() {
        let dir = std::env::temp_dir().join(format!("scd-offline-{}", uuid::Uuid::new_v4()));
        let path = write(&dir, b"{\"kind\":\"scd-diagnostics\"}").unwrap();
        let name = path.file_name().unwrap().to_string_lossy().into_owned();
        assert!(name.starts_with("scd-diagnostics-") && name.ends_with(".json"));
        assert_eq!(name.len(), "scd-diagnostics-20261029-1000.json".len());
        assert_eq!(
            std::fs::read(&path).unwrap(),
            b"{\"kind\":\"scd-diagnostics\"}"
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }
}

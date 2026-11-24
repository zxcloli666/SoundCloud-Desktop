use std::path::{Path, PathBuf};

use image::RgbaImage;

use super::picture;

const SIZES: [u32; 5] = [32, 64, 128, 256, 512];
const NAME: &str = "soundcloud-desktop.png";

pub fn write(icons_dir: &Path, chosen: Option<&RgbaImage>) -> Result<(), String> {
    SIZES
        .iter()
        .try_for_each(|size| write_size(&file(icons_dir, *size), *size, chosen))
        .map_err(|e| e.to_string())
}

fn file(icons_dir: &Path, size: u32) -> PathBuf {
    icons_dir
        .join("hicolor")
        .join(format!("{size}x{size}"))
        .join("apps")
        .join(NAME)
}

fn write_size(file: &Path, size: u32, chosen: Option<&RgbaImage>) -> std::io::Result<()> {
    let Some(chosen) = chosen else {
        return match std::fs::remove_file(file) {
            Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(error),
            _ => Ok(()),
        };
    };
    let png = picture::encode(&picture::fit(chosen, size)).map_err(std::io::Error::other)?;
    if std::fs::read(file).is_ok_and(|saved| saved == png) {
        return Ok(());
    }
    if let Some(dir) = file.parent() {
        std::fs::create_dir_all(dir)?;
    }
    std::fs::write(file, png)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_size_of_the_package_icon_is_covered_and_taken_back() {
        let dir = std::env::temp_dir().join(format!("scd-hicolor-{}", uuid::Uuid::new_v4()));
        let icon = RgbaImage::from_pixel(512, 512, image::Rgba([1, 2, 3, 255]));
        write(&dir, Some(&icon)).unwrap();
        for size in SIZES {
            let saved = picture::decode(&std::fs::read(file(&dir, size)).unwrap()).unwrap();
            assert_eq!(saved.dimensions(), (size, size));
        }
        write(&dir, None).unwrap();
        write(&dir, None).unwrap();
        assert!(SIZES.iter().all(|size| !file(&dir, *size).exists()));
    }
}

use std::path::{Path, PathBuf};

use image::codecs::ico::{IcoEncoder, IcoFrame};
use image::{ExtendedColorType, RgbaImage};
use sha2::{Digest, Sha256};

use super::picture;

const SIZES: [u32; 7] = [16, 20, 24, 32, 48, 64, 256];
const PREFIX: &str = "app-icon-";
const SUFFIX: &str = ".ico";

pub fn write(data_dir: &Path, chosen: &RgbaImage) -> Result<PathBuf, String> {
    let ico = encode(chosen).map_err(|e| e.to_string())?;
    let sha = hex::encode(&Sha256::digest(&ico)[..6]);
    let file = data_dir.join(format!("{PREFIX}{sha}{SUFFIX}"));
    if !file.exists() {
        std::fs::write(&file, ico).map_err(|e| e.to_string())?;
    }
    Ok(file)
}

pub fn remove_others(data_dir: &Path, keep: Option<&Path>) {
    let Ok(entries) = std::fs::read_dir(data_dir) else {
        return;
    };
    for path in entries.flatten().map(|entry| entry.path()) {
        if is_icon(&path) && Some(path.as_path()) != keep {
            let _ = std::fs::remove_file(path);
        }
    }
}

fn is_icon(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with(PREFIX) && name.ends_with(SUFFIX))
}

fn encode(chosen: &RgbaImage) -> image::ImageResult<Vec<u8>> {
    let frames = SIZES
        .iter()
        .map(|size| {
            let frame = picture::fit(chosen, *size);
            IcoFrame::as_png(frame.as_raw(), *size, *size, ExtendedColorType::Rgba8)
        })
        .collect::<image::ImageResult<Vec<_>>>()?;
    let mut ico = Vec::new();
    IcoEncoder::new(&mut ico).encode_images(&frames)?;
    Ok(ico)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_new_icon_gets_a_new_file_and_the_old_one_goes() {
        let dir = std::env::temp_dir().join(format!("scd-ico-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let icon = |shade| RgbaImage::from_pixel(512, 512, image::Rgba([shade, 0, 0, 255]));
        let first = write(&dir, &icon(1)).unwrap();
        let second = write(&dir, &icon(2)).unwrap();
        assert_ne!(first, second);
        assert_eq!(write(&dir, &icon(2)).unwrap(), second);

        remove_others(&dir, Some(&second));
        assert!(!first.exists());
        let ico = std::fs::read(&second).unwrap();
        assert_eq!(ico[..6], [0, 0, 1, 0, SIZES.len() as u8, 0]);

        remove_others(&dir, None);
        assert!(!second.exists());
    }
}

use std::io::Cursor;

use image::imageops::{self, FilterType};
use image::{ImageFormat, RgbaImage};
use tauri::image::Image;

pub fn decode(png: &[u8]) -> Result<RgbaImage, String> {
    image::load_from_memory_with_format(png, ImageFormat::Png)
        .map(|picture| picture.into_rgba8())
        .map_err(|e| e.to_string())
}

pub fn encode(picture: &RgbaImage) -> Result<Vec<u8>, String> {
    let mut png = Cursor::new(Vec::new());
    picture
        .write_to(&mut png, ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok(png.into_inner())
}

pub fn fit(picture: &RgbaImage, size: u32) -> RgbaImage {
    if picture.dimensions() == (size, size) {
        return picture.clone();
    }
    imageops::resize(picture, size, size, FilterType::Lanczos3)
}

pub fn to_tauri(picture: RgbaImage) -> Image<'static> {
    let (width, height) = picture.dimensions();
    Image::new_owned(picture.into_raw(), width, height)
}

#[cfg(any(target_os = "macos", test))]
pub fn with_margin(picture: &RgbaImage, size: u32, inner: u32) -> RgbaImage {
    let mut canvas = RgbaImage::new(size, size);
    let offset = i64::from((size - inner) / 2);
    imageops::replace(&mut canvas, &fit(picture, inner), offset, offset);
    canvas
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_margin_is_transparent_and_the_picture_is_centered() {
        let red = RgbaImage::from_pixel(8, 8, image::Rgba([255, 0, 0, 255]));
        let framed = with_margin(&red, 100, 80);
        assert_eq!(framed.get_pixel(9, 50).0[3], 0);
        assert_eq!(framed.get_pixel(10, 50).0, [255, 0, 0, 255]);
        assert_eq!(framed.get_pixel(89, 50).0, [255, 0, 0, 255]);
        assert_eq!(framed.get_pixel(90, 50).0[3], 0);
    }
}

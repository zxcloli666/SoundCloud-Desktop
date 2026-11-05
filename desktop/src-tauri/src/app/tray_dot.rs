const DOT: [f32; 3] = [255.0, 59.0, 48.0];
const DOT_SHARE: f32 = 0.2;
const GAP_SHARE: f32 = 0.07;

pub fn with_dot(rgba: &[u8], width: u32, height: u32) -> Vec<u8> {
    let mut out = rgba.to_vec();
    let size = width.min(height) as f32;
    let radius = (size * DOT_SHARE).max(2.0);
    let outer = radius + (size * GAP_SHARE).max(1.0);
    let center = (width as f32 - outer, outer);
    for (index, pixel) in out.chunks_exact_mut(4).enumerate() {
        let x = (index as u32 % width) as f32 + 0.5;
        let y = (index as u32 / width) as f32 + 0.5;
        let distance = ((x - center.0).powi(2) + (y - center.1).powi(2)).sqrt();
        let gap = coverage(outer, distance);
        if gap == 0.0 {
            continue;
        }
        pixel[3] = (pixel[3] as f32 * (1.0 - gap)).round() as u8;
        paint(pixel, coverage(radius, distance));
    }
    out
}

fn coverage(radius: f32, distance: f32) -> f32 {
    (radius + 0.5 - distance).clamp(0.0, 1.0)
}

fn paint(pixel: &mut [u8], alpha: f32) {
    if alpha == 0.0 {
        return;
    }
    let below = pixel[3] as f32 / 255.0 * (1.0 - alpha);
    let total = alpha + below;
    for (channel, dot) in pixel.iter_mut().zip(DOT) {
        *channel = ((dot * alpha + *channel as f32 * below) / total).round() as u8;
    }
    pixel[3] = (total * 255.0).round() as u8;
}

#[cfg(test)]
mod tests {
    use super::*;

    const SIZE: u32 = 32;

    fn icon(color: [u8; 4]) -> Vec<u8> {
        color.repeat((SIZE * SIZE) as usize)
    }

    fn pixel(rgba: &[u8], x: u32, y: u32) -> [u8; 4] {
        let at = ((y * SIZE + x) * 4) as usize;
        rgba[at..at + 4].try_into().unwrap()
    }

    #[test]
    fn paints_a_solid_dot_in_the_top_right_corner() {
        let dotted = with_dot(&icon([40, 20, 90, 255]), SIZE, SIZE);
        assert_eq!(pixel(&dotted, SIZE - 9, 8), [255, 59, 48, 255]);
    }

    #[test]
    fn cuts_a_clear_ring_around_the_dot() {
        let dotted = with_dot(&icon([40, 20, 90, 255]), SIZE, SIZE);
        let ring = pixel(&dotted, SIZE - 9, 1);
        assert_eq!(ring[3], 0);
    }

    #[test]
    fn leaves_the_rest_of_the_icon_alone() {
        let plain = icon([40, 20, 90, 255]);
        let dotted = with_dot(&plain, SIZE, SIZE);
        assert_eq!(pixel(&dotted, 2, SIZE - 3), [40, 20, 90, 255]);
        assert_eq!(pixel(&dotted, SIZE / 2, SIZE / 2 + 4), [40, 20, 90, 255]);
        assert_eq!(dotted.len(), plain.len());
    }

    #[test]
    fn works_on_a_transparent_icon() {
        let dotted = with_dot(&icon([0, 0, 0, 0]), SIZE, SIZE);
        assert_eq!(pixel(&dotted, SIZE - 9, 8), [255, 59, 48, 255]);
        assert_eq!(pixel(&dotted, 2, 2), [0, 0, 0, 0]);
    }
}

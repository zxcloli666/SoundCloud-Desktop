use std::fs::File;
use std::path::Path;

use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::{MetadataOptions, MetadataRevision, StandardTagKey, StandardVisualKey};
use symphonia::core::probe::Hint;

#[derive(Debug, Default)]
pub struct Cover {
    pub media_type: String,
    pub data: Vec<u8>,
    front: bool,
}

#[derive(Debug, Default)]
pub struct Tags {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub year: Option<u32>,
    pub track_number: Option<u32>,
    pub duration_ms: Option<u64>,
    pub cover: Option<Cover>,
}

impl Tags {
    fn absorb(&mut self, revision: &MetadataRevision) {
        for tag in revision.tags() {
            let Some(key) = tag.std_key else { continue };
            let value = tag.value.to_string();
            let value = value.trim();
            if value.is_empty() {
                continue;
            }
            let slot = match key {
                StandardTagKey::TrackTitle => &mut self.title,
                StandardTagKey::Artist => &mut self.artist,
                StandardTagKey::Album => &mut self.album,
                StandardTagKey::AlbumArtist => &mut self.album_artist,
                StandardTagKey::Genre => &mut self.genre,
                StandardTagKey::Date | StandardTagKey::OriginalDate => {
                    self.year = self.year.or_else(|| leading_number(value));
                    continue;
                }
                StandardTagKey::TrackNumber => {
                    self.track_number = self.track_number.or_else(|| leading_number(value));
                    continue;
                }
                _ => continue,
            };
            if slot.is_none() {
                *slot = Some(value.to_string());
            }
        }

        for visual in revision.visuals() {
            if visual.data.is_empty() {
                continue;
            }
            let front = visual.usage == Some(StandardVisualKey::FrontCover);
            if self.cover.as_ref().is_some_and(|c| c.front || !front) {
                continue;
            }
            self.cover = Some(Cover {
                media_type: visual.media_type.clone(),
                data: visual.data.to_vec(),
                front,
            });
        }
    }
}

fn leading_number(value: &str) -> Option<u32> {
    let digits: String = value.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse().ok().filter(|n| *n > 0)
}

pub fn read(path: &Path) -> Tags {
    let mut tags = Tags::default();
    let Ok(file) = File::open(path) else {
        return tags;
    };
    let stream = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }
    let Ok(mut probed) = symphonia::default::get_probe().format(
        &hint,
        stream,
        &FormatOptions::default(),
        &MetadataOptions::default(),
    ) else {
        return tags;
    };

    if let Some(revision) = probed.metadata.get().as_ref().and_then(|m| m.current()) {
        tags.absorb(revision);
    }
    if let Some(revision) = probed.format.metadata().current() {
        tags.absorb(revision);
    }

    tags.duration_ms = probed.format.default_track().and_then(|track| {
        let params = &track.codec_params;
        let frames = params.n_frames?;
        if let Some(base) = params.time_base {
            let time = base.calc_time(frames);
            return Some(time.seconds * 1000 + (time.frac * 1000.0) as u64);
        }
        let rate = u64::from(params.sample_rate?);
        (rate > 0).then(|| frames * 1000 / rate)
    });

    tags
}

pub fn cover_extension(media_type: &str) -> &'static str {
    match media_type.to_ascii_lowercase().as_str() {
        "image/png" => "png",
        "image/webp" => "webp",
        "image/gif" => "gif",
        _ => "jpg",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn leading_number_reads_years_and_track_slots() {
        assert_eq!(leading_number("2021-04-01"), Some(2021));
        assert_eq!(leading_number("3/12"), Some(3));
        assert_eq!(leading_number("0"), None);
        assert_eq!(leading_number("abc"), None);
    }

    #[test]
    fn cover_extension_maps_known_types() {
        assert_eq!(cover_extension("image/PNG"), "png");
        assert_eq!(cover_extension("image/jpeg"), "jpg");
        assert_eq!(cover_extension(""), "jpg");
    }

    #[test]
    fn unreadable_file_yields_empty_tags() {
        let tags = read(Path::new("/definitely/not/here.mp3"));
        assert!(tags.title.is_none());
        assert!(tags.duration_ms.is_none());
    }
}

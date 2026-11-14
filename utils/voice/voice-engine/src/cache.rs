use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use sha2::{Digest, Sha256};

use crate::clip::Clip;

const CAP: u64 = 64 << 20;

pub struct Cache {
    dir: PathBuf,
    cap: u64,
}

pub fn key(parts: &[&str]) -> String {
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update((part.len() as u64).to_le_bytes());
        hasher.update(part.as_bytes());
    }
    hasher
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

impl Cache {
    pub fn new(dir: PathBuf) -> Cache {
        Cache { dir, cap: CAP }
    }

    pub fn get(&self, key: &str) -> Option<Clip> {
        let path = self.path(key);
        let clip = Clip::from_wav(&fs::read(&path).ok()?).ok()?;
        if let Ok(file) = fs::File::options().write(true).open(&path) {
            let _ = file.set_modified(SystemTime::now());
        }
        Some(clip)
    }

    pub fn put(&self, key: &str, clip: &Clip) {
        if clip.samples.is_empty() || clip.rate == 0 {
            return;
        }
        let path = self.path(key);
        let part = path.with_extension("part");
        if write(&part, clip).is_ok() && fs::rename(&part, &path).is_ok() {
            self.trim();
        } else {
            let _ = fs::remove_file(&part);
        }
    }

    fn path(&self, key: &str) -> PathBuf {
        self.dir.join(format!("{key}.wav"))
    }

    fn trim(&self) {
        let Ok(entries) = fs::read_dir(&self.dir) else {
            return;
        };
        let mut files: Vec<(SystemTime, u64, PathBuf)> = entries
            .flatten()
            .filter_map(|entry| {
                let meta = entry.metadata().ok()?;
                Some((meta.modified().ok()?, meta.len(), entry.path()))
            })
            .collect();
        files.sort();
        let mut total: u64 = files.iter().map(|(_, size, _)| size).sum();
        for (_, size, path) in files {
            if total <= self.cap {
                return;
            }
            if fs::remove_file(&path).is_ok() {
                total -= size;
            }
        }
    }
}

fn write(path: &Path, clip: &Clip) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: clip.rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::create(path, spec).map_err(|e| e.to_string())?;
    for sample in &clip.samples {
        let value = (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
        writer.write_sample(value).map_err(|e| e.to_string())?;
    }
    writer.finalize().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("voice-cache-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    fn clip(seconds: f32) -> Clip {
        Clip {
            samples: (0..(24000.0 * seconds) as usize)
                .map(|i| (i as f32 * 0.01).sin() * 0.5)
                .collect(),
            rate: 24000,
        }
    }

    #[test]
    fn a_phrase_comes_back_as_it_was_said() {
        let cache = Cache::new(dir("round"));
        let key = key(&["qwen-loli", "1", "Включаю."]);
        assert!(cache.get(&key).is_none());
        let said = clip(0.5);
        cache.put(&key, &said);
        let back = cache.get(&key).expect("cached");
        assert_eq!(back.rate, 24000);
        assert_eq!(back.samples.len(), said.samples.len());
        let worst = back
            .samples
            .iter()
            .zip(&said.samples)
            .map(|(a, b)| (a - b).abs())
            .fold(0.0f32, f32::max);
        assert!(worst < 0.001, "{worst}");
    }

    #[test]
    fn keys_differ_by_voice_and_by_text() {
        let base = key(&["qwen-loli", "1", "Включаю."]);
        assert_ne!(base, key(&["qwen-moriarty", "1", "Включаю."]));
        assert_ne!(base, key(&["qwen-loli", "1", "Выключаю."]));
        assert_ne!(key(&["ab", "c"]), key(&["a", "bc"]));
        assert_eq!(base.len(), 64);
    }

    #[test]
    fn old_phrases_leave_when_the_cache_is_full() {
        let mut cache = Cache::new(dir("trim"));
        cache.cap = 120_000;
        cache.put("first", &clip(1.0));
        std::thread::sleep(std::time::Duration::from_millis(30));
        cache.put("second", &clip(1.0));
        std::thread::sleep(std::time::Duration::from_millis(30));
        assert!(cache.get("first").is_some());
        std::thread::sleep(std::time::Duration::from_millis(30));
        cache.put("third", &clip(1.0));
        assert!(cache.get("second").is_none());
        assert!(cache.get("first").is_some());
        assert!(cache.get("third").is_some());
    }

    #[test]
    fn silence_is_not_cached() {
        let cache = Cache::new(dir("empty"));
        cache.put("nothing", &Clip::default());
        assert!(cache.get("nothing").is_none());
    }
}

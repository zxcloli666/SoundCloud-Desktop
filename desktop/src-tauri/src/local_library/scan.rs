use std::collections::HashSet;
use std::path::{Path, PathBuf};

const AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "m4a", "mp4", "aac", "flac", "ogg", "oga", "opus", "wav",
];
const MAX_DEPTH: usize = 16;
const MAX_FILES: usize = 20_000;

pub fn is_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|ext| AUDIO_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()))
}

fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .and_then(|n| n.to_str())
        .is_some_and(|n| n.starts_with('.'))
}

fn walk(dir: &Path, depth: usize, seen: &mut HashSet<PathBuf>, out: &mut Vec<PathBuf>) {
    if depth > MAX_DEPTH || out.len() >= MAX_FILES {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let mut paths: Vec<PathBuf> = entries.flatten().map(|e| e.path()).collect();
    paths.sort();
    for path in paths {
        if out.len() >= MAX_FILES {
            return;
        }
        if is_hidden(&path) {
            continue;
        }
        if path.is_dir() {
            let Ok(real) = path.canonicalize() else {
                continue;
            };
            if seen.insert(real) {
                walk(&path, depth + 1, seen, out);
            }
        } else if is_audio_file(&path) {
            out.push(path);
        }
    }
}

pub fn collect(roots: &[PathBuf]) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for root in roots {
        if root.is_dir() {
            if let Ok(real) = root.canonicalize() {
                seen.insert(real);
            }
            walk(root, 0, &mut seen, &mut out);
        } else if is_audio_file(root) && root.is_file() {
            out.push(root.clone());
        }
    }
    let mut unique = HashSet::new();
    out.retain(|p| unique.insert(p.clone()));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("scd-local-scan-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn audio_extensions_are_case_insensitive() {
        assert!(is_audio_file(Path::new("a/B.MP3")));
        assert!(is_audio_file(Path::new("song.m4a")));
        assert!(!is_audio_file(Path::new("cover.jpg")));
        assert!(!is_audio_file(Path::new("noext")));
    }

    #[test]
    fn collect_walks_folders_and_skips_hidden_and_duplicates() {
        let dir = temp_dir("walk");
        std::fs::create_dir_all(dir.join("album")).unwrap();
        std::fs::create_dir_all(dir.join(".hidden")).unwrap();
        for file in [
            "one.mp3",
            "album/two.flac",
            "album/cover.jpg",
            ".hidden/three.mp3",
        ] {
            std::fs::write(dir.join(file), b"x").unwrap();
        }

        let found = collect(&[dir.clone(), dir.join("one.mp3")]);
        let names: Vec<_> = found
            .iter()
            .map(|p| {
                p.strip_prefix(&dir)
                    .unwrap()
                    .to_string_lossy()
                    .replace('\\', "/")
            })
            .collect();
        assert_eq!(names, vec!["album/two.flac", "one.mp3"]);

        std::fs::remove_dir_all(&dir).unwrap();
    }
}

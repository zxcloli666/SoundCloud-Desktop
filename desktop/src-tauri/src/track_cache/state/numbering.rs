use std::collections::HashMap;
use std::fs;
use std::path::Path;

use super::export::plain_file_name;

pub fn renumber(dir: &Path, names: &[String]) {
    let saved = saved_files(dir);
    for name in names.iter().filter_map(|name| plain_file_name(name)) {
        let dest = dir.join(name);
        if dest.exists() {
            continue;
        }
        if let Some(old) = saved.get(unnumbered(name)) {
            fs::rename(dir.join(old), dest).ok();
        }
    }
}

fn saved_files(dir: &Path) -> HashMap<String, String> {
    let names: Vec<String> = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .filter_map(|entry| entry.ok()?.file_name().into_string().ok())
        .collect();
    let numbered = names
        .iter()
        .map(|name| (unnumbered(name).to_string(), name.clone()));
    let plain = names.iter().map(|name| (name.clone(), name.clone()));
    numbered.chain(plain).collect()
}

fn unnumbered(name: &str) -> &str {
    match name.split_once(" - ") {
        Some((number, rest))
            if !number.is_empty() && number.bytes().all(|byte| byte.is_ascii_digit()) =>
        {
            rest
        }
        _ => name,
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};

    use super::{renumber, unnumbered};

    fn folder(files: &[&str]) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("sc-numbering-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        for file in files {
            fs::write(dir.join(file), file).unwrap();
        }
        dir
    }

    fn renumbered(files: &[&str], names: &[&str]) -> Vec<(String, String)> {
        let dir = folder(files);
        let names: Vec<String> = names.iter().map(|name| name.to_string()).collect();
        renumber(&dir, &names);
        let mut left: Vec<(String, String)> = fs::read_dir(&dir)
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .map(|path| (file_name(&path), fs::read_to_string(&path).unwrap()))
            .collect();
        left.sort();
        fs::remove_dir_all(dir).unwrap();
        left
    }

    fn file_name(path: &Path) -> String {
        path.file_name().unwrap().to_str().unwrap().to_string()
    }

    fn pairs(expected: &[(&str, &str)]) -> Vec<(String, String)> {
        expected
            .iter()
            .map(|(name, was)| (name.to_string(), was.to_string()))
            .collect()
    }

    #[test]
    fn only_a_leading_number_is_cut() {
        assert_eq!(unnumbered("07 - Luma - Night.m4a"), "Luma - Night.m4a");
        assert_eq!(unnumbered("Luma - Night.m4a"), "Luma - Night.m4a");
        assert_eq!(unnumbered("07 Luma - Night.m4a"), "07 Luma - Night.m4a");
        assert_eq!(unnumbered(" - Night.m4a"), " - Night.m4a");
    }

    #[test]
    fn files_saved_before_numbers_get_them() {
        assert_eq!(
            renumbered(
                &["Luma - Night.m4a", "24 - Hours.m4a"],
                &["01 - Luma - Night.m4a", "02 - 24 - Hours.m4a"],
            ),
            pairs(&[
                ("01 - Luma - Night.m4a", "Luma - Night.m4a"),
                ("02 - 24 - Hours.m4a", "24 - Hours.m4a"),
            ])
        );
    }

    #[test]
    fn a_moved_track_takes_its_new_number() {
        assert_eq!(
            renumbered(
                &["01 - A - a.m4a", "02 - B - b.m4a"],
                &["001 - B - b.m4a", "002 - A - a.m4a", "003 - C - c.m4a"],
            ),
            pairs(&[
                ("001 - B - b.m4a", "02 - B - b.m4a"),
                ("002 - A - a.m4a", "01 - A - a.m4a"),
            ])
        );
    }

    #[test]
    fn other_formats_and_files_in_place_stay() {
        let files = ["01 - A - a.m4a", "02 - A - a.m4a", "A - a.mp3", "notes.txt"];
        assert_eq!(
            renumbered(&files, &["02 - A - a.m4a"]),
            pairs(&files.map(|file| (file, file)))
        );
    }
}

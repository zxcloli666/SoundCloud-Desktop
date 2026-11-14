use std::fs;
use std::io;
use std::path::PathBuf;

pub struct SerialStore {
    path: PathBuf,
}

impl SerialStore {
    pub fn at(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn highest(&self) -> i64 {
        fs::read_to_string(&self.path)
            .ok()
            .and_then(|text| text.trim().parse().ok())
            .unwrap_or(0)
    }

    pub fn record(&self, serial: i64) -> io::Result<()> {
        if serial <= self.highest() {
            return Ok(());
        }
        let staging = self.path.with_extension("tmp");
        fs::write(&staging, serial.to_string())?;
        fs::rename(&staging, &self.path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store(name: &str) -> SerialStore {
        let dir =
            std::env::temp_dir().join(format!("boosty-card-serial-{name}-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("serial");
        let _ = fs::remove_file(&path);
        SerialStore::at(path)
    }

    #[test]
    fn nothing_seen_yet_is_zero() {
        assert_eq!(store("empty").highest(), 0);
    }

    #[test]
    fn the_highest_serial_is_kept_across_restarts() {
        let first = store("keep");
        first.record(10).unwrap();
        first.record(7).unwrap();
        let again = SerialStore::at(first.path.clone());
        assert_eq!(again.highest(), 10);
        again.record(12).unwrap();
        assert_eq!(first.highest(), 12);
    }

    #[test]
    fn a_damaged_file_reads_as_zero() {
        let damaged = store("damaged");
        fs::write(&damaged.path, "garbage").unwrap();
        assert_eq!(damaged.highest(), 0);
    }
}

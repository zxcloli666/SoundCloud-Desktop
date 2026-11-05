use std::fs::{self, File, OpenOptions};
use std::io::{ErrorKind, Read, Write};
use std::path::{Path, PathBuf};

use sc_chat::{ChatError, ChatResult, KeyName, Zeroizing};

use super::Vault;

const DIR: &str = "keys";

pub struct FileVault {
    dir: PathBuf,
}

impl FileVault {
    pub fn new(chat_dir: &Path) -> Self {
        Self {
            dir: chat_dir.join(DIR),
        }
    }

    pub fn exists(&self) -> bool {
        self.dir.is_dir()
    }

    pub fn create(&self) -> ChatResult<()> {
        fs::create_dir_all(&self.dir).map_err(failed)?;
        private_dir(&self.dir)
    }

    fn path(&self, name: KeyName) -> PathBuf {
        self.dir.join(name.as_str())
    }
}

impl Vault for FileVault {
    fn load(&self, name: KeyName) -> ChatResult<Option<Zeroizing<Vec<u8>>>> {
        let mut file = match File::open(self.path(name)) {
            Ok(file) => file,
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(failed(error)),
        };
        let mut secret = Zeroizing::new(Vec::new());
        file.read_to_end(&mut secret).map_err(failed)?;
        Ok(Some(secret))
    }

    fn save(&self, name: KeyName, secret: &[u8]) -> ChatResult<()> {
        self.create()?;
        let path = self.path(name);
        let staged = path.with_extension("new");
        write_private(&staged, secret)?;
        fs::rename(&staged, &path).map_err(|error| {
            let _ = fs::remove_file(&staged);
            failed(error)
        })
    }

    fn delete(&self, name: KeyName) -> ChatResult<()> {
        match fs::remove_file(self.path(name)) {
            Err(error) if error.kind() != ErrorKind::NotFound => Err(failed(error)),
            _ => Ok(()),
        }
    }
}

fn write_private(path: &Path, secret: &[u8]) -> ChatResult<()> {
    let mut options = OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(path).map_err(failed)?;
    file.write_all(secret).map_err(failed)?;
    file.sync_all().map_err(failed)
}

#[cfg(unix)]
fn private_dir(dir: &Path) -> ChatResult<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(dir, fs::Permissions::from_mode(0o700)).map_err(failed)
}

#[cfg(not(unix))]
fn private_dir(_dir: &Path) -> ChatResult<()> {
    Ok(())
}

fn failed(_error: std::io::Error) -> ChatError {
    ChatError::Keychain
}

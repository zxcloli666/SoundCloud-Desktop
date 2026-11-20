use std::fs::{self, File, TryLockError};
use std::path::Path;

use crate::error::Error;

pub struct ModelLock {
    _file: File,
}

impl ModelLock {
    pub fn acquire(root: &Path, id: &str) -> Result<Self, Error> {
        let dir = root.join(".locks");
        fs::create_dir_all(&dir)?;
        let file = File::options()
            .create(true)
            .write(true)
            .truncate(false)
            .open(dir.join(format!("{id}.lock")))?;
        match file.try_lock() {
            Ok(()) => Ok(ModelLock { _file: file }),
            Err(TryLockError::WouldBlock) => Err(Error::Busy(id.to_string())),
            Err(TryLockError::Error(e)) => Err(e.into()),
        }
    }
}

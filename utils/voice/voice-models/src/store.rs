use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::mpsc::Sender;
use std::time::Duration;

use crate::cancel::Cancel;
use crate::download::{Report, download_file, hash_file, part_path};
use crate::error::Error;
use crate::fetch::Fetch;
use crate::lock::ModelLock;
use crate::manifest::{Manifest, Model};
use crate::progress::Progress;

const BUSY_POLL: Duration = Duration::from_millis(200);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    Missing,
    Partial(u64),
    Ready,
    Corrupted,
}

#[derive(Clone, Debug)]
pub struct Options {
    pub retries: u32,
    pub backoff: Duration,
}

impl Default for Options {
    fn default() -> Self {
        Options {
            retries: 5,
            backoff: Duration::from_secs(1),
        }
    }
}

pub struct Store {
    root: PathBuf,
    manifest: Manifest,
    fetch: Arc<dyn Fetch>,
    options: Options,
}

impl Store {
    pub fn new(root: impl Into<PathBuf>, fetch: Arc<dyn Fetch>) -> Store {
        Store::with_manifest(root, Manifest::embedded(), fetch, Options::default())
    }

    pub fn with_manifest(
        root: impl Into<PathBuf>,
        manifest: Manifest,
        fetch: Arc<dyn Fetch>,
        options: Options,
    ) -> Store {
        Store {
            root: root.into(),
            manifest,
            fetch,
            options,
        }
    }

    pub fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    pub fn model_dir(&self, id: &str) -> Result<PathBuf, Error> {
        let model = self.manifest.get(id)?;
        Ok(self.dir_of(model))
    }

    pub fn status(&self, id: &str) -> Result<Status, Error> {
        let model = self.manifest.get(id)?;
        let dir = self.dir_of(model);
        let mut bytes = 0;
        let mut complete = 0;
        for file in &model.files {
            let path = dir.join(&file.path);
            match fs::metadata(&path) {
                Ok(meta) if meta.len() == file.size => {
                    bytes += file.size;
                    complete += 1;
                }
                Ok(_) => return Ok(Status::Corrupted),
                Err(_) => {
                    let part = fs::metadata(part_path(&path)).map(|m| m.len()).unwrap_or(0);
                    bytes += part.min(file.size);
                }
            }
        }
        Ok(if complete == model.files.len() {
            Status::Ready
        } else if bytes > 0 {
            Status::Partial(bytes)
        } else {
            Status::Missing
        })
    }

    pub fn verify(&self, id: &str) -> Result<Status, Error> {
        let model = self.manifest.get(id)?;
        let _lock = ModelLock::acquire(&self.root, id)?;
        let status = self.status(id)?;
        if status != Status::Ready {
            return Ok(status);
        }
        let dir = self.dir_of(model);
        let mut bad = false;
        for file in &model.files {
            let path = dir.join(&file.path);
            if hash_file(&path)? != file.sha256.to_ascii_lowercase() {
                fs::remove_file(&path)?;
                bad = true;
            }
        }
        Ok(if bad {
            Status::Corrupted
        } else {
            Status::Ready
        })
    }

    pub fn install(
        &self,
        id: &str,
        cancel: &Cancel,
        progress: Option<&Sender<Progress>>,
    ) -> Result<(), Error> {
        let model = self.manifest.get(id)?;
        for dep in &model.requires {
            self.install_shared(self.manifest.get(dep)?, cancel, progress)?;
        }
        self.install_one(model, cancel, progress)
    }

    pub fn delete(&self, id: &str) -> Result<(), Error> {
        self.manifest.get(id)?;
        let _lock = ModelLock::acquire(&self.root, id)?;
        match fs::remove_dir_all(self.root.join(id)) {
            Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.into()),
            _ => Ok(()),
        }
    }

    pub fn disk_usage(&self) -> u64 {
        dir_size(&self.root)
    }

    fn dir_of(&self, model: &Model) -> PathBuf {
        self.root.join(&model.id).join(&model.version)
    }

    fn install_shared(
        &self,
        model: &Model,
        cancel: &Cancel,
        progress: Option<&Sender<Progress>>,
    ) -> Result<(), Error> {
        loop {
            match self.install_one(model, cancel, progress) {
                Err(Error::Busy(_)) if cancel.is_cancelled() => return Err(Error::Cancelled),
                Err(Error::Busy(_)) => std::thread::sleep(BUSY_POLL),
                done => return done,
            }
        }
    }

    fn install_one(
        &self,
        model: &Model,
        cancel: &Cancel,
        progress: Option<&Sender<Progress>>,
    ) -> Result<(), Error> {
        let _lock = ModelLock::acquire(&self.root, &model.id)?;
        let dir = self.dir_of(model);
        fs::create_dir_all(&dir)?;
        let mut report = Report {
            tx: progress,
            model: &model.id,
            model_total: model.unpacked_size,
            model_done: 0,
        };
        for file in &model.files {
            let dest = dir.join(&file.path);
            match fs::metadata(&dest) {
                Ok(meta) if meta.len() == file.size => {}
                Ok(_) => {
                    fs::remove_file(&dest)?;
                    download_file(
                        self.fetch.as_ref(),
                        &self.options,
                        cancel,
                        &report,
                        file,
                        &dest,
                    )?;
                }
                Err(_) => download_file(
                    self.fetch.as_ref(),
                    &self.options,
                    cancel,
                    &report,
                    file,
                    &dest,
                )?,
            }
            report.model_done += file.size;
        }
        remove_other_versions(&self.root.join(&model.id), &model.version);
        Ok(())
    }
}

fn remove_other_versions(model_root: &Path, keep: &str) {
    let Ok(entries) = fs::read_dir(model_root) else {
        return;
    };
    for entry in entries.flatten() {
        if entry.file_name() != keep {
            let _ = fs::remove_dir_all(entry.path());
        }
    }
}

fn dir_size(path: &Path) -> u64 {
    let Ok(entries) = fs::read_dir(path) else {
        return 0;
    };
    entries
        .flatten()
        .map(|entry| match entry.metadata() {
            Ok(meta) if meta.is_dir() => dir_size(&entry.path()),
            Ok(meta) => meta.len(),
            Err(_) => 0,
        })
        .sum()
}

use std::collections::HashSet;

use serde::Deserialize;

use crate::error::Error;

pub const STORAGE_BASE: &str = "https://storage.scnative.dev/voice-models";

const EMBEDDED: &str = include_str!("../manifest.json");

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Vad,
    Asr,
    Kws,
    Tts,
    Llm,
    Aux,
    Engine,
}

#[derive(Clone, Debug, Deserialize)]
pub struct File {
    pub path: String,
    #[serde(default)]
    pub url: String,
    pub size: u64,
    pub sha256: String,
    #[serde(default)]
    pub executable: bool,
}

#[derive(Clone, Debug, Deserialize)]
pub struct Model {
    pub id: String,
    pub version: String,
    pub kind: Kind,
    pub language: String,
    pub license: String,
    pub unpacked_size: u64,
    #[serde(default)]
    pub platform: Option<String>,
    #[serde(default)]
    pub requires: Vec<String>,
    pub files: Vec<File>,
}

#[derive(Deserialize)]
struct Raw {
    models: Vec<Model>,
    #[serde(default)]
    retired: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct Manifest {
    pub models: Vec<Model>,
    pub retired: Vec<String>,
}

impl Manifest {
    pub fn embedded() -> Manifest {
        Manifest::parse(EMBEDDED)
            .expect("embedded manifest is valid")
            .on(&platform())
    }

    pub fn on(mut self, platform: &str) -> Manifest {
        self.models
            .retain(|model| model.platform.as_deref().is_none_or(|p| p == platform));
        self
    }

    pub fn parse(text: &str) -> Result<Manifest, Error> {
        let mut raw: Raw =
            serde_json::from_str(text).map_err(|e| Error::Manifest(e.to_string()))?;
        for model in &mut raw.models {
            for file in &mut model.files {
                if file.url.is_empty() {
                    file.url = format!(
                        "{STORAGE_BASE}/{}/{}/{}",
                        model.id, model.version, file.path
                    );
                }
            }
        }
        let manifest = Manifest {
            models: raw.models,
            retired: raw.retired,
        };
        manifest.check()?;
        Ok(manifest)
    }

    pub fn from_models(models: Vec<Model>) -> Result<Manifest, Error> {
        let manifest = Manifest {
            models,
            retired: Vec::new(),
        };
        manifest.check()?;
        Ok(manifest)
    }

    pub fn get(&self, id: &str) -> Result<&Model, Error> {
        self.models
            .iter()
            .find(|m| m.id == id)
            .ok_or_else(|| Error::UnknownModel(id.to_string()))
    }

    fn check(&self) -> Result<(), Error> {
        let mut ids = HashSet::new();
        for model in &self.models {
            if !ids.insert(model.id.as_str()) {
                return Err(bad(format!("duplicate id {}", model.id)));
            }
            if model.files.is_empty() {
                return Err(bad(format!("{} has no files", model.id)));
            }
            let sum: u64 = model.files.iter().map(|f| f.size).sum();
            if sum != model.unpacked_size {
                return Err(bad(format!(
                    "{} unpacked_size is {} but files sum to {sum}",
                    model.id, model.unpacked_size
                )));
            }
            let mut paths = HashSet::new();
            for file in &model.files {
                let clean = !file.path.is_empty()
                    && !file.path.starts_with('/')
                    && !file.path.contains('\\')
                    && file
                        .path
                        .split('/')
                        .all(|p| !p.is_empty() && p != "." && p != "..");
                if !clean {
                    return Err(bad(format!("{}: bad path {}", model.id, file.path)));
                }
                if !paths.insert(file.path.as_str()) {
                    return Err(bad(format!("{}: duplicate path {}", model.id, file.path)));
                }
                let hex =
                    file.sha256.len() == 64 && file.sha256.bytes().all(|b| b.is_ascii_hexdigit());
                if !hex {
                    return Err(bad(format!("{}: bad sha256 for {}", model.id, file.path)));
                }
            }
            for dep in &model.requires {
                if !self.models.iter().any(|m| &m.id == dep) {
                    return Err(bad(format!("{} requires unknown {dep}", model.id)));
                }
            }
        }
        for id in &self.retired {
            let named = !id.is_empty() && !id.starts_with('.') && !id.contains(['/', '\\']);
            if !named || ids.contains(id.as_str()) {
                return Err(bad(format!("{id} cannot be retired")));
            }
        }
        Ok(())
    }
}

pub fn platform() -> String {
    format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH)
}

fn bad(text: String) -> Error {
    Error::Manifest(text)
}

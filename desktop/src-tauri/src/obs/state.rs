use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use serde::{Deserialize, Serialize};
use tokio::sync::{watch, Mutex};

use super::server;
use super::snapshot::{NowPlaying, Snapshot};
use super::text;

pub struct Shared {
    pub snapshot: watch::Sender<Snapshot>,
    pub template: RwLock<String>,
}

impl Shared {
    pub fn render(&self, np: &NowPlaying) -> String {
        let template = self.template.read().map(|t| t.clone()).unwrap_or_default();
        text::render(&template, np)
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsConfig {
    pub server: bool,
    pub port: u16,
    pub txt_path: Option<String>,
    pub template: String,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ServerStatus {
    #[default]
    Off,
    Running,
    Busy,
    Failed,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsStatus {
    pub server: ServerStatus,
    pub port: u16,
    pub txt_error: Option<String>,
}

#[derive(Default)]
struct ServerSlot {
    alive: Option<watch::Sender<()>>,
    port: u16,
    status: ServerStatus,
}

#[derive(Default)]
struct TxtTarget {
    path: Option<PathBuf>,
    written: Option<String>,
    error: Option<String>,
}

pub struct ObsState {
    shared: Arc<Shared>,
    server: Mutex<ServerSlot>,
    txt: Mutex<TxtTarget>,
}

impl Default for ObsState {
    fn default() -> Self {
        Self {
            shared: Arc::new(Shared {
                snapshot: watch::Sender::new(Snapshot::default()),
                template: RwLock::new(text::DEFAULT_TEMPLATE.to_owned()),
            }),
            server: Mutex::default(),
            txt: Mutex::default(),
        }
    }
}

impl ObsState {
    pub async fn configure(&self, config: ObsConfig) -> ObsStatus {
        if let Ok(mut template) = self.shared.template.write() {
            *template = config.template;
        }
        let path = config
            .txt_path
            .filter(|p| !p.trim().is_empty())
            .map(PathBuf::from);
        {
            let mut txt = self.txt.lock().await;
            if txt.path != path {
                *txt = TxtTarget {
                    path,
                    ..TxtTarget::default()
                };
            }
        }
        self.write_txt().await;
        self.apply_server(config.server, config.port).await;
        self.status().await
    }

    pub async fn update(&self, np: NowPlaying) -> ObsStatus {
        self.shared.snapshot.send_if_modified(|snapshot| {
            if snapshot.np == np {
                return false;
            }
            *snapshot = snapshot.next(np);
            true
        });
        self.write_txt().await;
        self.status().await
    }

    pub async fn status(&self) -> ObsStatus {
        let server = self.server.lock().await;
        let txt = self.txt.lock().await;
        ObsStatus {
            server: server.status,
            port: server.port,
            txt_error: txt.error.clone(),
        }
    }

    async fn apply_server(&self, wanted: bool, port: u16) {
        let mut slot = self.server.lock().await;
        if wanted && slot.alive.is_some() && slot.port == port {
            return;
        }
        *slot = ServerSlot {
            port,
            ..ServerSlot::default()
        };
        if !wanted {
            return;
        }
        match server::start(self.shared.clone(), port) {
            Ok(alive) => {
                slot.alive = Some(alive);
                slot.status = ServerStatus::Running;
            }
            Err(e) => {
                slot.status = if e.kind() == std::io::ErrorKind::AddrInUse {
                    ServerStatus::Busy
                } else {
                    ServerStatus::Failed
                };
            }
        }
    }

    async fn write_txt(&self) {
        let mut txt = self.txt.lock().await;
        let Some(path) = txt.path.clone() else {
            return;
        };
        let content = self.shared.render(&self.shared.snapshot.borrow().np);
        if txt.written.as_deref() == Some(content.as_str()) {
            return;
        }
        match tokio::fs::write(&path, content.as_bytes()).await {
            Ok(()) => {
                txt.written = Some(content);
                txt.error = None;
            }
            Err(e) => txt.error = Some(e.to_string()),
        }
    }
}

use tokio::sync::watch;

pub struct Signals {
    visible: watch::Sender<bool>,
    generation: watch::Sender<u64>,
}

impl Signals {
    pub fn new() -> Self {
        Self {
            visible: watch::Sender::new(false),
            generation: watch::Sender::new(0),
        }
    }

    pub fn visible(&self) -> bool {
        *self.visible.borrow()
    }

    pub fn set_visible(&self, visible: bool) -> bool {
        self.visible.send_if_modified(|current| {
            let changed = *current != visible;
            *current = visible;
            changed
        })
    }

    pub fn generation(&self) -> u64 {
        *self.generation.borrow()
    }

    pub fn restart(&self) {
        self.generation.send_modify(|generation| *generation += 1);
    }

    pub async fn restarted(&self, since: u64) {
        let mut generation = self.generation.subscribe();
        let _ = generation.wait_for(|current| *current != since).await;
    }
}

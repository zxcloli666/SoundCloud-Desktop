use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use sc_chat::{ChatError, ChatResult, KeyName, Zeroizing};

use super::Vault;

#[derive(Clone, Default)]
pub struct SharedVault {
    keys: Arc<Mutex<HashMap<KeyName, Vec<u8>>>>,
    failure: Arc<Mutex<Option<ChatError>>>,
}

impl SharedVault {
    pub fn fail_with(&self, failure: Option<ChatError>) {
        *self.failure.lock().unwrap() = failure;
    }

    pub fn holds(&self, name: KeyName) -> bool {
        self.keys.lock().unwrap().contains_key(&name)
    }

    fn check(&self) -> ChatResult<()> {
        match self.failure.lock().unwrap().clone() {
            Some(failure) => Err(failure),
            None => Ok(()),
        }
    }
}

impl Vault for SharedVault {
    fn load(&self, name: KeyName) -> ChatResult<Option<Zeroizing<Vec<u8>>>> {
        self.check()?;
        Ok(self
            .keys
            .lock()
            .unwrap()
            .get(&name)
            .cloned()
            .map(Zeroizing::new))
    }

    fn save(&self, name: KeyName, secret: &[u8]) -> ChatResult<()> {
        self.check()?;
        self.keys.lock().unwrap().insert(name, secret.to_vec());
        Ok(())
    }

    fn delete(&self, name: KeyName) -> ChatResult<()> {
        self.check()?;
        self.keys.lock().unwrap().remove(&name);
        Ok(())
    }
}

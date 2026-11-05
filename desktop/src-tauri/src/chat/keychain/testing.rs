use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
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

pub struct Broken;

impl Vault for Broken {
    fn load(&self, _name: KeyName) -> ChatResult<Option<Zeroizing<Vec<u8>>>> {
        Err(ChatError::Keychain)
    }

    fn save(&self, _name: KeyName, _secret: &[u8]) -> ChatResult<()> {
        Err(ChatError::Keychain)
    }

    fn delete(&self, _name: KeyName) -> ChatResult<()> {
        Err(ChatError::Keychain)
    }
}

#[derive(Clone, Default)]
pub struct Refusing {
    pub asked: Arc<AtomicU32>,
    pub allow_after: Option<u32>,
}

impl Refusing {
    fn answer<T>(&self, granted: T) -> ChatResult<T> {
        let asked = self.asked.fetch_add(1, Ordering::SeqCst) + 1;
        match self.allow_after {
            Some(after) if asked > after => Ok(granted),
            _ => Err(ChatError::KeychainDenied),
        }
    }

    pub fn asked(&self) -> u32 {
        self.asked.load(Ordering::SeqCst)
    }
}

impl Vault for Refusing {
    fn load(&self, _name: KeyName) -> ChatResult<Option<Zeroizing<Vec<u8>>>> {
        self.answer(None)
    }

    fn save(&self, _name: KeyName, _secret: &[u8]) -> ChatResult<()> {
        self.answer(())
    }

    fn delete(&self, _name: KeyName) -> ChatResult<()> {
        self.answer(())
    }
}

#[derive(Clone, Default)]
pub struct Sticky(pub SharedVault);

impl Vault for Sticky {
    fn load(&self, name: KeyName) -> ChatResult<Option<Zeroizing<Vec<u8>>>> {
        self.0.load(name)
    }

    fn save(&self, name: KeyName, secret: &[u8]) -> ChatResult<()> {
        self.0.save(name, secret)
    }

    fn delete(&self, _name: KeyName) -> ChatResult<()> {
        Ok(())
    }
}

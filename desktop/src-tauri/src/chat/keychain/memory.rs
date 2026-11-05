use std::collections::HashMap;
use std::sync::Mutex;

use sc_chat::{ChatError, ChatResult, KeyName, Zeroizing};

use super::Vault;

#[derive(Default)]
pub struct MemoryVault {
    secrets: Mutex<HashMap<KeyName, Zeroizing<Vec<u8>>>>,
}

impl Vault for MemoryVault {
    fn load(&self, name: KeyName) -> ChatResult<Option<Zeroizing<Vec<u8>>>> {
        let secrets = self.secrets.lock().map_err(|_| ChatError::Keychain)?;
        Ok(secrets
            .get(&name)
            .map(|secret| Zeroizing::new(secret.to_vec())))
    }

    fn save(&self, name: KeyName, secret: &[u8]) -> ChatResult<()> {
        let mut secrets = self.secrets.lock().map_err(|_| ChatError::Keychain)?;
        secrets.insert(name, Zeroizing::new(secret.to_vec()));
        Ok(())
    }

    fn delete(&self, name: KeyName) -> ChatResult<()> {
        let mut secrets = self.secrets.lock().map_err(|_| ChatError::Keychain)?;
        secrets.remove(&name);
        Ok(())
    }
}

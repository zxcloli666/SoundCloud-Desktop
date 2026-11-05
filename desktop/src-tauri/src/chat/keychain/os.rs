use keyring::{Entry, Error};
use sc_chat::{ChatError, ChatResult, KeyName, Zeroizing};

use super::Vault;
use crate::app::diagnostics;

pub struct OsVault {
    service: String,
}

impl OsVault {
    pub fn new(service: &str) -> Self {
        Self {
            service: service.to_string(),
        }
    }

    fn entry(&self, name: KeyName) -> ChatResult<Entry> {
        Entry::new(&self.service, name.as_str()).map_err(|error| failed(name, error))
    }
}

impl Vault for OsVault {
    fn load(&self, name: KeyName) -> ChatResult<Option<Zeroizing<Vec<u8>>>> {
        match self.entry(name)?.get_secret() {
            Ok(secret) => Ok(Some(Zeroizing::new(secret))),
            Err(Error::NoEntry) => Ok(None),
            Err(error) => Err(failed(name, error)),
        }
    }

    fn save(&self, name: KeyName, secret: &[u8]) -> ChatResult<()> {
        self.entry(name)?
            .set_secret(secret)
            .map_err(|error| failed(name, error))
    }

    fn delete(&self, name: KeyName) -> ChatResult<()> {
        match self.entry(name)?.delete_credential() {
            Ok(()) | Err(Error::NoEntry) => Ok(()),
            Err(error) => Err(failed(name, error)),
        }
    }
}

fn failed(name: KeyName, error: Error) -> ChatError {
    diagnostics::warn(format!("[chat] keychain {}: {error}", name.as_str()));
    if refused(&error) {
        ChatError::KeychainDenied
    } else {
        ChatError::Keychain
    }
}

#[cfg(target_os = "macos")]
fn refused(error: &Error) -> bool {
    const USER_CANCELED: i32 = -128;
    const AUTH_FAILED: i32 = -25293;
    const INTERACTION_NOT_ALLOWED: i32 = -25308;
    match error {
        Error::PlatformFailure(inner) | Error::NoStorageAccess(inner) => inner
            .downcast_ref::<security_framework::base::Error>()
            .is_some_and(|status| {
                matches!(
                    status.code(),
                    USER_CANCELED | AUTH_FAILED | INTERACTION_NOT_ALLOWED
                )
            }),
        _ => false,
    }
}

#[cfg(target_os = "linux")]
fn refused(error: &Error) -> bool {
    match error {
        Error::NoStorageAccess(inner) => inner
            .downcast_ref::<secret_service::Error>()
            .is_some_and(|failure| matches!(failure, secret_service::Error::Prompt)),
        _ => false,
    }
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn refused(_error: &Error) -> bool {
    false
}

#[cfg(test)]
mod tests;

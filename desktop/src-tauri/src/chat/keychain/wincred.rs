use std::ptr;
use std::sync::{Mutex, MutexGuard, PoisonError};

use sc_chat::{ChatError, ChatResult, KeyName, Zeroizing};
use windows_sys::Win32::Foundation::{ERROR_INVALID_PARAMETER, ERROR_NOT_FOUND, GetLastError};
use windows_sys::Win32::Security::Credentials::{
    CRED_PERSIST_ENTERPRISE, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC, CREDENTIALW,
    CredDeleteW, CredFree, CredReadW, CredWriteW,
};

use super::Vault;
use super::cred_move::{self, Credentials, ENTERPRISE, Failure, LOCAL_MACHINE, Localized, Stored};
use crate::app::diagnostics;

const _: () = assert!(LOCAL_MACHINE == CRED_PERSIST_LOCAL_MACHINE);
const _: () = assert!(ENTERPRISE == CRED_PERSIST_ENTERPRISE);

static STORE: Mutex<()> = Mutex::new(());

pub struct CredVault {
    service: String,
}

pub struct WinCred;

impl CredVault {
    pub fn new(service: &str) -> Self {
        Self {
            service: service.to_string(),
        }
    }

    pub fn target(&self, name: KeyName) -> String {
        format!("{}.{}", name.as_str(), self.service)
    }
}

impl Vault for CredVault {
    fn load(&self, name: KeyName) -> ChatResult<Option<Zeroizing<Vec<u8>>>> {
        let target = self.target(name);
        let _held = held();
        let loaded =
            cred_move::load(&WinCred, &target, name.as_str()).map_err(|code| failed(name, code))?;
        let Some((found, localized)) = loaded else {
            return Ok(None);
        };
        match localized {
            None | Some(Localized::Moved) => {}
            Some(Localized::Finished) => diagnostics::warn(format!(
                "[chat] keychain {} finished an interrupted move",
                name.as_str()
            )),
            Some(other) => diagnostics::warn(format!(
                "[chat] keychain {} stays roaming: {other:?}",
                name.as_str()
            )),
        }
        Ok(Some(found.secret))
    }

    fn save(&self, name: KeyName, secret: &[u8]) -> ChatResult<()> {
        let target = self.target(name);
        let _held = held();
        cred_move::save(&WinCred, &target, name.as_str(), secret)
            .map_err(|failure| failed_with(name, failure))
    }

    fn delete(&self, name: KeyName) -> ChatResult<()> {
        let target = self.target(name);
        let _held = held();
        cred_move::delete(&WinCred, &target).map_err(|failure| failed_with(name, failure))
    }
}

impl Credentials for WinCred {
    fn read(&self, target: &str) -> Result<Option<Stored>, u32> {
        let name = wide(target);
        let mut found: *mut CREDENTIALW = ptr::null_mut();
        if unsafe { CredReadW(name.as_ptr(), CRED_TYPE_GENERIC, 0, &mut found) } == 0 {
            return match unsafe { GetLastError() } {
                ERROR_NOT_FOUND => Ok(None),
                code => Err(code),
            };
        }
        let stored = unsafe {
            let credential = &*found;
            let secret = if credential.CredentialBlob.is_null() {
                Vec::new()
            } else {
                std::slice::from_raw_parts(
                    credential.CredentialBlob,
                    credential.CredentialBlobSize as usize,
                )
                .to_vec()
            };
            Stored {
                secret: Zeroizing::new(secret),
                persist: credential.Persist,
            }
        };
        unsafe { CredFree(found as *const core::ffi::c_void) };
        Ok(Some(stored))
    }

    fn write(&self, target: &str, user: &str, secret: &[u8], persist: u32) -> Result<(), u32> {
        let mut name = wide(target);
        let mut user = wide(user);
        let mut blob = Zeroizing::new(secret.to_vec());
        let size = u32::try_from(blob.len()).map_err(|_| ERROR_INVALID_PARAMETER)?;
        let credential = CREDENTIALW {
            Type: CRED_TYPE_GENERIC,
            TargetName: name.as_mut_ptr(),
            UserName: user.as_mut_ptr(),
            CredentialBlobSize: size,
            CredentialBlob: blob.as_mut_ptr(),
            Persist: persist,
            ..Default::default()
        };
        if unsafe { CredWriteW(&credential, 0) } == 0 {
            return Err(unsafe { GetLastError() });
        }
        Ok(())
    }

    fn delete(&self, target: &str) -> Result<(), u32> {
        let name = wide(target);
        if unsafe { CredDeleteW(name.as_ptr(), CRED_TYPE_GENERIC, 0) } == 0 {
            return match unsafe { GetLastError() } {
                ERROR_NOT_FOUND => Ok(()),
                code => Err(code),
            };
        }
        Ok(())
    }
}

fn held() -> MutexGuard<'static, ()> {
    STORE.lock().unwrap_or_else(PoisonError::into_inner)
}

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}

fn failed(name: KeyName, code: u32) -> ChatError {
    diagnostics::warn(format!(
        "[chat] keychain {}: windows error {code}",
        name.as_str()
    ));
    ChatError::Keychain
}

fn failed_with(name: KeyName, failure: Failure) -> ChatError {
    match failure {
        Failure::Os(code) => failed(name, code),
        Failure::Unconfirmed => {
            diagnostics::warn(format!(
                "[chat] keychain {} does not read back what was written",
                name.as_str()
            ));
            ChatError::Keychain
        }
    }
}

#[cfg(test)]
mod tests;

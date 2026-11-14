use sc_chat::Zeroizing;

pub const LOCAL_MACHINE: u32 = 2;
pub const ENTERPRISE: u32 = 3;
pub const ATTEMPTS: usize = 3;

pub struct Stored {
    pub secret: Zeroizing<Vec<u8>>,
    pub persist: u32,
}

pub trait Credentials {
    fn read(&self, target: &str) -> Result<Option<Stored>, u32>;
    fn write(&self, target: &str, user: &str, secret: &[u8], persist: u32) -> Result<(), u32>;
    fn delete(&self, target: &str) -> Result<(), u32>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Failure {
    Os(u32),
    Unconfirmed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Localized {
    Moved,
    Finished,
    Unwritten(Failure),
    Undeleted(Failure),
    Unfinished(Failure),
}

pub fn spare(target: &str) -> String {
    format!("{target}.moving")
}

pub fn load(
    creds: &impl Credentials,
    target: &str,
    user: &str,
) -> Result<Option<(Stored, Option<Localized>)>, u32> {
    let spare_target = spare(target);
    let found = creds.read(target)?;
    let spare = creds.read(&spare_target)?;
    match (found, spare) {
        (None, None) => Ok(None),
        (None, Some(spare)) => {
            let localized = finish(creds, target, user, &spare.secret);
            Ok(Some((spare, Some(localized))))
        }
        (Some(found), spare) if found.persist != ENTERPRISE => {
            if spare.is_some() {
                let _ = remove(creds, &spare_target);
            }
            Ok(Some((found, None)))
        }
        (Some(found), _) => {
            let localized = relocate(creds, target, user, &found.secret);
            Ok(Some((found, Some(localized))))
        }
    }
}

pub fn save(
    creds: &impl Credentials,
    target: &str,
    user: &str,
    secret: &[u8],
) -> Result<(), Failure> {
    let found = creds.read(target).map_err(Failure::Os)?;
    if found.is_none_or(|found| found.persist == LOCAL_MACHINE) {
        return put(creds, target, user, secret);
    }
    match relocate(creds, target, user, secret) {
        Localized::Moved | Localized::Finished => Ok(()),
        Localized::Unwritten(failure)
        | Localized::Undeleted(failure)
        | Localized::Unfinished(failure) => Err(failure),
    }
}

pub fn delete(creds: &impl Credentials, target: &str) -> Result<(), Failure> {
    remove(creds, &spare(target))?;
    remove(creds, target)
}

fn relocate(creds: &impl Credentials, target: &str, user: &str, secret: &[u8]) -> Localized {
    let spare_target = spare(target);
    if let Err(failure) = put(creds, &spare_target, user, secret) {
        let _ = remove(creds, &spare_target);
        return Localized::Unwritten(failure);
    }
    if let Err(failure) = remove(creds, target) {
        return Localized::Undeleted(failure);
    }
    match finish(creds, target, user, secret) {
        Localized::Finished => Localized::Moved,
        other => other,
    }
}

fn finish(creds: &impl Credentials, target: &str, user: &str, secret: &[u8]) -> Localized {
    if let Err(failure) = put(creds, target, user, secret) {
        return Localized::Unfinished(failure);
    }
    let _ = remove(creds, &spare(target));
    Localized::Finished
}

fn put(creds: &impl Credentials, target: &str, user: &str, secret: &[u8]) -> Result<(), Failure> {
    for _ in 0..ATTEMPTS {
        creds
            .write(target, user, secret, LOCAL_MACHINE)
            .map_err(Failure::Os)?;
        if matches!(
            creds.read(target),
            Ok(Some(back)) if back.persist == LOCAL_MACHINE && *back.secret == *secret
        ) {
            return Ok(());
        }
    }
    Err(Failure::Unconfirmed)
}

fn remove(creds: &impl Credentials, target: &str) -> Result<(), Failure> {
    for _ in 0..ATTEMPTS {
        creds.delete(target).map_err(Failure::Os)?;
        if creds.read(target).map_err(Failure::Os)?.is_none() {
            return Ok(());
        }
    }
    Err(Failure::Unconfirmed)
}

#[cfg(test)]
mod tests;

use sc_chat::Zeroizing;

pub const LOCAL_MACHINE: u32 = 2;
pub const ENTERPRISE: u32 = 3;

pub struct Stored {
    pub secret: Zeroizing<Vec<u8>>,
    pub persist: u32,
}

pub trait Credentials {
    fn read(&self, target: &str) -> Result<Option<Stored>, u32>;
    fn write(&self, target: &str, user: &str, secret: &[u8], persist: u32) -> Result<(), u32>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Localized {
    Moved,
    Unwritten(u32),
    Restored,
    Unrestored(u32),
}

pub fn localize(creds: &impl Credentials, target: &str, user: &str, found: &Stored) -> Localized {
    if let Err(code) = creds.write(target, user, &found.secret, LOCAL_MACHINE) {
        return Localized::Unwritten(code);
    }
    match creds.read(target) {
        Ok(Some(back)) if back.persist == LOCAL_MACHINE && *back.secret == *found.secret => {
            Localized::Moved
        }
        _ => match creds.write(target, user, &found.secret, found.persist) {
            Ok(()) => Localized::Restored,
            Err(code) => Localized::Unrestored(code),
        },
    }
}

pub fn load(
    creds: &impl Credentials,
    target: &str,
    user: &str,
) -> Result<Option<(Stored, Option<Localized>)>, u32> {
    let Some(found) = creds.read(target)? else {
        return Ok(None);
    };
    if found.persist != ENTERPRISE {
        return Ok(Some((found, None)));
    }
    let localized = localize(creds, target, user, &found);
    Ok(Some((found, Some(localized))))
}

#[cfg(test)]
mod tests;

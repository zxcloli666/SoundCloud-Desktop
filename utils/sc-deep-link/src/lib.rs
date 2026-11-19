use std::fmt;

const SCHEME: &str = "sc";
const HOST: &str = "auth";
const MAX_FIELD_LEN: usize = 512;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthCallback {
    pub code: String,
    pub state: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    Scheme,
    Target,
    Missing(&'static str),
    Length(&'static str),
    Charset(&'static str),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Scheme => f.write_str("not an sc:// address"),
            Error::Target => f.write_str("not an sc://auth address"),
            Error::Missing(field) => write!(f, "{field} is missing"),
            Error::Length(field) => write!(f, "{field} has a bad length"),
            Error::Charset(field) => write!(f, "{field} has forbidden characters"),
        }
    }
}

impl std::error::Error for Error {}

pub fn parse_auth(raw: &str) -> Result<AuthCallback, Error> {
    let rest = strip_scheme(raw.trim())?;
    let rest = rest.split('#').next().unwrap_or_default();
    let (target, query) = rest.split_once('?').unwrap_or((rest, ""));
    if !is_auth_target(target) {
        return Err(Error::Target);
    }
    Ok(AuthCallback {
        code: field(query, "code")?,
        state: field(query, "state")?,
    })
}

fn strip_scheme(raw: &str) -> Result<&str, Error> {
    let (scheme, rest) = raw.split_once("://").ok_or(Error::Scheme)?;
    if scheme.eq_ignore_ascii_case(SCHEME) {
        Ok(rest)
    } else {
        Err(Error::Scheme)
    }
}

fn is_auth_target(target: &str) -> bool {
    let host = target.strip_suffix('/').unwrap_or(target);
    host.eq_ignore_ascii_case(HOST)
}

fn field(query: &str, name: &'static str) -> Result<String, Error> {
    let value = query
        .split('&')
        .filter_map(|pair| pair.split_once('='))
        .find(|(key, _)| *key == name)
        .map(|(_, value)| value)
        .filter(|value| !value.is_empty())
        .ok_or(Error::Missing(name))?;
    if value.len() > MAX_FIELD_LEN {
        return Err(Error::Length(name));
    }
    if !value.bytes().all(is_token_byte) {
        return Err(Error::Charset(name));
    }
    Ok(value.to_owned())
}

fn is_token_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~')
}

#[cfg(test)]
mod tests;

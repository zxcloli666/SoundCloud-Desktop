use md5::{Digest, Md5};
use serde_json::Value;

use super::error::ApiError;
use super::store::{Profile, Scrobble};
use crate::shared::constants::{LASTFM_API_KEY, LASTFM_API_SECRET};

const API: &str = "https://ws.audioscrobbler.com/2.0/";
const AUTH_PAGE: &str = "https://www.last.fm/api/auth/";
pub const BATCH: usize = 50;

#[derive(Clone, Copy)]
pub struct Credentials {
    key: &'static str,
    secret: &'static str,
}

pub fn credentials() -> Option<Credentials> {
    let key = LASTFM_API_KEY.filter(|v| !v.trim().is_empty())?;
    let secret = LASTFM_API_SECRET.filter(|v| !v.trim().is_empty())?;
    Some(Credentials {
        key: key.trim(),
        secret: secret.trim(),
    })
}

fn signature(params: &[(String, String)], secret: &str) -> String {
    let mut sorted: Vec<&(String, String)> = params.iter().collect();
    sorted.sort_by(|a, b| a.0.cmp(&b.0));
    let mut hasher = Md5::new();
    for (key, value) in sorted {
        hasher.update(key.as_bytes());
        hasher.update(value.as_bytes());
    }
    hasher.update(secret.as_bytes());
    hex::encode(hasher.finalize())
}

fn classify(code: i64, message: &str) -> ApiError {
    match code {
        14 => ApiError::Pending,
        4 | 9 | 15 => ApiError::Session,
        8 | 11 | 16 | 29 => ApiError::Retry(format!("{code}: {message}")),
        _ => ApiError::Rejected(format!("{code}: {message}")),
    }
}

async fn call(
    http: &wreq::Client,
    creds: Credentials,
    method: &str,
    mut params: Vec<(String, String)>,
) -> Result<Value, ApiError> {
    params.push(("method".into(), method.into()));
    params.push(("api_key".into(), creds.key.into()));
    let sig = signature(&params, creds.secret);
    let body = url::form_urlencoded::Serializer::new(String::new())
        .extend_pairs(params.iter())
        .append_pair("api_sig", &sig)
        .append_pair("format", "json")
        .finish();
    let response = http
        .post(API)
        .header("content-type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(ApiError::network)?;
    let status = response.status().as_u16();
    let text = response.text().await.map_err(ApiError::network)?;
    let json: Option<Value> = serde_json::from_str(&text).ok();
    if let Some(code) = json
        .as_ref()
        .and_then(|v| v.get("error"))
        .and_then(Value::as_i64)
    {
        let message = json
            .as_ref()
            .and_then(|v| v.get("message"))
            .and_then(Value::as_str)
            .unwrap_or_default();
        return Err(classify(code, message));
    }
    match json {
        Some(value) if status < 400 => Ok(value),
        _ => Err(ApiError::from_status(status, &text)),
    }
}

fn pair(key: impl Into<String>, value: impl Into<String>) -> (String, String) {
    (key.into(), value.into())
}

pub async fn request_token(http: &wreq::Client, creds: Credentials) -> Result<String, ApiError> {
    let value = call(http, creds, "auth.getToken", Vec::new()).await?;
    value
        .get("token")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| ApiError::Rejected("no token in response".into()))
}

pub fn auth_url(creds: Credentials, token: &str) -> String {
    format!(
        "{AUTH_PAGE}?api_key={}&token={}",
        urlencoding::encode(creds.key),
        urlencoding::encode(token)
    )
}

pub async fn session(
    http: &wreq::Client,
    creds: Credentials,
    token: &str,
) -> Result<(String, String), ApiError> {
    let value = call(http, creds, "auth.getSession", vec![pair("token", token)]).await?;
    let session = value.get("session");
    let name = session.and_then(|s| s.get("name")).and_then(Value::as_str);
    let key = session.and_then(|s| s.get("key")).and_then(Value::as_str);
    match (name, key) {
        (Some(name), Some(key)) => Ok((name.to_owned(), key.to_owned())),
        _ => Err(ApiError::Rejected("no session in response".into())),
    }
}

fn number(value: Option<&Value>) -> Option<u64> {
    let value = value?;
    value
        .as_u64()
        .or_else(|| value.as_str().and_then(|s| s.parse().ok()))
}

fn largest_image(user: &Value) -> Option<String> {
    user.get("image")?
        .as_array()?
        .iter()
        .rev()
        .filter_map(|image| image.get("#text").and_then(Value::as_str))
        .find(|url| !url.is_empty())
        .map(str::to_owned)
}

pub async fn profile(
    http: &wreq::Client,
    creds: Credentials,
    name: &str,
) -> Result<Profile, ApiError> {
    let value = call(http, creds, "user.getInfo", vec![pair("user", name)]).await?;
    let user = value
        .get("user")
        .ok_or_else(|| ApiError::Rejected("no user in response".into()))?;
    Ok(Profile {
        name: user
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or(name)
            .to_owned(),
        url: user.get("url").and_then(Value::as_str).map(str::to_owned),
        image: largest_image(user),
        playcount: number(user.get("playcount")),
        since: number(user.get("registered").and_then(|r| r.get("unixtime"))).map(|v| v as i64),
    })
}

pub async fn now_playing(
    http: &wreq::Client,
    creds: Credentials,
    session_key: &str,
    track: &Scrobble,
) -> Result<(), ApiError> {
    let mut params = vec![
        pair("artist", &track.artist),
        pair("track", &track.title),
        pair("sk", session_key),
    ];
    if let Some(duration) = track.duration_secs {
        params.push(pair("duration", duration.to_string()));
    }
    call(http, creds, "track.updateNowPlaying", params)
        .await
        .map(|_| ())
}

pub async fn scrobble(
    http: &wreq::Client,
    creds: Credentials,
    session_key: &str,
    batch: &[Scrobble],
) -> Result<(), ApiError> {
    let mut params = vec![pair("sk", session_key)];
    for (i, track) in batch.iter().enumerate() {
        params.push(pair(format!("artist[{i}]"), &track.artist));
        params.push(pair(format!("track[{i}]"), &track.title));
        params.push(pair(format!("timestamp[{i}]"), track.timestamp.to_string()));
        if let Some(duration) = track.duration_secs {
            params.push(pair(format!("duration[{i}]"), duration.to_string()));
        }
    }
    call(http, creds, "track.scrobble", params)
        .await
        .map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signature_sorts_params_and_appends_secret() {
        let params = vec![
            pair("token", "t0k"),
            pair("api_key", "k3y"),
            pair("method", "auth.getSession"),
        ];
        let expected = {
            let mut hasher = Md5::new();
            hasher.update(b"api_keyk3ymethodauth.getSessiontokent0ks3cret");
            hex::encode(hasher.finalize())
        };
        assert_eq!(signature(&params, "s3cret"), expected);
    }

    #[test]
    fn errors_are_classified() {
        assert!(matches!(classify(14, ""), ApiError::Pending));
        assert!(matches!(classify(9, ""), ApiError::Session));
        assert!(matches!(classify(29, ""), ApiError::Retry(_)));
        assert!(matches!(classify(6, ""), ApiError::Rejected(_)));
    }

    #[test]
    fn profile_fields_parse_from_strings() {
        let user: Value = serde_json::json!({
            "image": [{"#text": "small.png"}, {"#text": "big.png"}, {"#text": ""}],
            "playcount": "1234"
        });
        assert_eq!(largest_image(&user).as_deref(), Some("big.png"));
        assert_eq!(number(user.get("playcount")), Some(1234));
    }
}

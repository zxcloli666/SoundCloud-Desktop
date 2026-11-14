use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::Deserialize;

use crate::guard;

const DOMAIN: &[u8] = b"scd-pay-bundle-v1";

#[derive(Clone, Debug, Deserialize)]
pub struct Bundle {
    pub serial: i64,
    pub not_after: i64,
    pub kid: String,
    pub entry: String,
    pub allowed_hosts: Vec<String>,
    pub script: String,
    pub sig: String,
}

#[derive(Debug, PartialEq, Eq, thiserror::Error)]
pub enum Reject {
    #[error("unknown_key")]
    UnknownKey,
    #[error("bad_signature")]
    BadSignature,
    #[error("expired")]
    Expired,
    #[error("old_serial")]
    OldSerial,
    #[error("bad_hosts")]
    BadHosts,
    #[error("entry")]
    Entry,
    #[error("serial_not_saved")]
    SerialNotSaved,
}

impl Reject {
    pub fn code(&self) -> &'static str {
        match self {
            Reject::UnknownKey => "unknown_key",
            Reject::BadSignature => "bad_signature",
            Reject::Expired => "expired",
            Reject::OldSerial => "old_serial",
            Reject::BadHosts => "bad_hosts",
            Reject::Entry => "entry",
            Reject::SerialNotSaved => "serial_not_saved",
        }
    }
}

#[derive(Clone, Default)]
pub struct Keys(Vec<(String, VerifyingKey)>);

impl Keys {
    pub fn parse(csv: &str) -> Self {
        let pairs = csv.split(',').filter_map(|pair| {
            let (kid, key) = pair.trim().split_once(':')?;
            let bytes: [u8; 32] = STANDARD.decode(key.trim()).ok()?.try_into().ok()?;
            Some((
                kid.trim().to_string(),
                VerifyingKey::from_bytes(&bytes).ok()?,
            ))
        });
        Self(pairs.collect())
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    fn find(&self, kid: &str) -> Option<&VerifyingKey> {
        self.0
            .iter()
            .find(|(known, _)| known == kid)
            .map(|(_, key)| key)
    }
}

impl Bundle {
    pub fn signing_input(&self) -> Vec<u8> {
        let mut out = DOMAIN.to_vec();
        field(&mut out, self.serial.to_string().as_bytes());
        field(&mut out, self.not_after.to_string().as_bytes());
        field(&mut out, self.kid.as_bytes());
        field(&mut out, self.entry.as_bytes());
        field(&mut out, self.allowed_hosts.join("\n").as_bytes());
        field(&mut out, self.script.as_bytes());
        out
    }

    fn signed_by(&self, key: &VerifyingKey) -> bool {
        let Ok(bytes) = STANDARD.decode(&self.sig) else {
            return false;
        };
        let Ok(sig) = Signature::from_slice(&bytes) else {
            return false;
        };
        key.verify(&self.signing_input(), &sig).is_ok()
    }
}

fn field(out: &mut Vec<u8>, bytes: &[u8]) {
    out.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
    out.extend_from_slice(bytes);
}

pub fn check(bundle: &Bundle, keys: &Keys, now: i64, highest_serial: i64) -> Result<(), Reject> {
    let key = keys.find(&bundle.kid).ok_or(Reject::UnknownKey)?;
    if !bundle.signed_by(key) {
        return Err(Reject::BadSignature);
    }
    if bundle.not_after <= now {
        return Err(Reject::Expired);
    }
    if bundle.serial < highest_serial {
        return Err(Reject::OldSerial);
    }
    if !guard::valid_host_list(&bundle.allowed_hosts) {
        return Err(Reject::BadHosts);
    }
    Ok(())
}

#[cfg(test)]
pub(crate) mod tests {
    use ed25519_dalek::{Signer, SigningKey};

    use super::*;

    pub fn key(seed: u8) -> SigningKey {
        SigningKey::from_bytes(&[seed; 32])
    }

    pub fn keys(seed: u8) -> Keys {
        let public = STANDARD.encode(key(seed).verifying_key().to_bytes());
        Keys::parse(&format!("k1:{public}"))
    }

    pub fn sample(script: &str, hosts: &[&str]) -> Bundle {
        Bundle {
            serial: 7,
            not_after: 2_000,
            kid: "k1".into(),
            entry: "bind".into(),
            allowed_hosts: hosts.iter().map(|host| host.to_string()).collect(),
            script: script.into(),
            sig: String::new(),
        }
    }

    pub fn signed(mut bundle: Bundle, key: &SigningKey) -> Bundle {
        bundle.sig = STANDARD.encode(key.sign(&bundle.signing_input()).to_bytes());
        bundle
    }

    fn good() -> Bundle {
        signed(sample("return 1", &["proxy-ee.smart-glocal.com"]), &key(1))
    }

    #[test]
    fn a_signed_bundle_passes() {
        assert_eq!(check(&good(), &keys(1), 1_000, 7), Ok(()));
    }

    #[test]
    fn a_foreign_key_is_refused() {
        assert_eq!(
            check(&good(), &keys(2), 1_000, 0),
            Err(Reject::BadSignature)
        );
    }

    #[test]
    fn an_unknown_kid_is_refused() {
        let mut bundle = good();
        bundle.kid = "k9".into();
        assert_eq!(check(&bundle, &keys(1), 1_000, 0), Err(Reject::UnknownKey));
    }

    #[test]
    fn an_expired_bundle_is_refused() {
        assert_eq!(check(&good(), &keys(1), 2_000, 0), Err(Reject::Expired));
        assert_eq!(check(&good(), &keys(1), 2_001, 0), Err(Reject::Expired));
    }

    #[test]
    fn a_serial_below_the_highest_seen_is_refused() {
        assert_eq!(check(&good(), &keys(1), 1_000, 8), Err(Reject::OldSerial));
        assert_eq!(check(&good(), &keys(1), 1_000, 7), Ok(()));
    }

    #[test]
    fn any_changed_field_breaks_the_signature() {
        let edits: [fn(&mut Bundle); 6] = [
            |b| b.script = "return 2".into(),
            |b| b.allowed_hosts.push("evil.example".into()),
            |b| b.serial = 8,
            |b| b.not_after = 9_999,
            |b| b.entry = "other".into(),
            |b| b.kid = "k2".into(),
        ];
        let both = Keys::parse(&format!(
            "k1:{},k2:{}",
            STANDARD.encode(key(1).verifying_key().to_bytes()),
            STANDARD.encode(key(1).verifying_key().to_bytes())
        ));
        for edit in edits {
            let mut bundle = good();
            edit(&mut bundle);
            assert_eq!(check(&bundle, &both, 1_000, 0), Err(Reject::BadSignature));
        }
    }

    #[test]
    fn field_boundaries_are_not_ambiguous() {
        let mut a = sample("s", &["c"]);
        a.entry = "ab".into();
        let mut b = sample("s", &["bc"]);
        b.entry = "a".into();
        assert_ne!(a.signing_input(), b.signing_input());
    }

    #[test]
    fn a_garbage_signature_is_refused() {
        let mut bundle = good();
        bundle.sig = "not base64!".into();
        assert_eq!(
            check(&bundle, &keys(1), 1_000, 0),
            Err(Reject::BadSignature)
        );
        bundle.sig = STANDARD.encode([0u8; 10]);
        assert_eq!(
            check(&bundle, &keys(1), 1_000, 0),
            Err(Reject::BadSignature)
        );
    }

    #[test]
    fn a_bundle_with_a_bad_host_list_is_refused_even_when_signed() {
        for hosts in [
            vec![],
            vec!["10.0.0.1"],
            vec!["localhost"],
            vec!["a.example", "127.0.0.1"],
        ] {
            let bundle = signed(sample("return 1", &hosts), &key(1));
            assert_eq!(
                check(&bundle, &keys(1), 1_000, 0),
                Err(Reject::BadHosts),
                "{hosts:?}"
            );
        }
    }

    #[test]
    fn two_keys_are_read_from_the_csv_and_garbage_is_skipped() {
        let first = STANDARD.encode(key(3).verifying_key().to_bytes());
        let second = STANDARD.encode(key(4).verifying_key().to_bytes());
        let parsed = Keys::parse(&format!("old:{first}, bad, new:{second},x:!!"));
        assert!(parsed.find("old").is_some());
        assert!(parsed.find("new").is_some());
        assert!(parsed.find("x").is_none());
        assert!(Keys::parse("").is_empty());
    }

    #[test]
    fn the_rotation_key_signs_too() {
        let first = STANDARD.encode(key(3).verifying_key().to_bytes());
        let second = STANDARD.encode(key(4).verifying_key().to_bytes());
        let keys = Keys::parse(&format!("old:{first},new:{second}"));
        let mut bundle = sample("return 1", &["a.example"]);
        bundle.kid = "new".into();
        let bundle = signed(bundle, &key(4));
        assert_eq!(check(&bundle, &keys, 1_000, 0), Ok(()));
    }
}

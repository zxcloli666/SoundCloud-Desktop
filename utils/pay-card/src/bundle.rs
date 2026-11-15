use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::Deserialize;

use crate::guard;

const DOMAIN: &[u8] = b"scd-pay-bundle-v2";
pub const CONTRACT: i64 = 2;
pub const SERIAL_FLOOR: i64 = 10_000_000_000;
const ENTRY_LEN: usize = 32;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Flow {
    CardForm,
    Confirm,
}

impl Flow {
    pub fn as_str(self) -> &'static str {
        match self {
            Flow::CardForm => "card_form",
            Flow::Confirm => "confirm",
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
pub struct Bundle {
    pub contract: i64,
    pub serial: i64,
    pub not_after: i64,
    pub kid: String,
    pub entry: String,
    pub flow: Flow,
    pub allowed_hosts: Vec<String>,
    pub page_hosts: Vec<String>,
    pub result_url: String,
    pub script: String,
    pub sig: String,
}

#[derive(Debug, PartialEq, Eq, thiserror::Error)]
pub enum Reject {
    #[error("contract")]
    Contract,
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
    #[error("bad_result_url")]
    BadResultUrl,
    #[error("entry")]
    Entry,
    #[error("params")]
    Params,
    #[error("serial_not_saved")]
    SerialNotSaved,
}

impl Reject {
    pub fn code(&self) -> &'static str {
        match self {
            Reject::Contract => "contract",
            Reject::UnknownKey => "unknown_key",
            Reject::BadSignature => "bad_signature",
            Reject::Expired => "expired",
            Reject::OldSerial => "old_serial",
            Reject::BadHosts => "bad_hosts",
            Reject::BadResultUrl => "bad_result_url",
            Reject::Entry => "entry",
            Reject::Params => "params",
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
        for part in [
            self.contract.to_string().as_bytes(),
            self.serial.to_string().as_bytes(),
            self.not_after.to_string().as_bytes(),
            self.kid.as_bytes(),
            self.entry.as_bytes(),
            self.flow.as_str().as_bytes(),
            self.allowed_hosts.join("\n").as_bytes(),
            self.page_hosts.join("\n").as_bytes(),
            self.result_url.as_bytes(),
            self.script.as_bytes(),
        ] {
            field(&mut out, part);
        }
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

pub fn valid_entry(entry: &str) -> bool {
    !entry.is_empty()
        && entry.len() <= ENTRY_LEN
        && entry
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
}

pub fn check(bundle: &Bundle, keys: &Keys, now: i64, highest_serial: i64) -> Result<(), Reject> {
    if bundle.contract != CONTRACT || bundle.serial <= SERIAL_FLOOR {
        return Err(Reject::Contract);
    }
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
    if !valid_entry(&bundle.entry) {
        return Err(Reject::Entry);
    }
    if !guard::valid_host_list(&bundle.allowed_hosts) || !guard::valid_host_list(&bundle.page_hosts)
    {
        return Err(Reject::BadHosts);
    }
    if !guard::acceptable_page(&bundle.result_url) {
        return Err(Reject::BadResultUrl);
    }
    Ok(())
}

#[cfg(test)]
pub(crate) mod tests {
    use ed25519_dalek::{Signer, SigningKey};

    use super::*;

    pub const SERIAL: i64 = SERIAL_FLOOR + 1_800_000_000;
    pub const RESULT_URL: &str = "https://pay.example/app/payment/result";

    pub fn key(seed: u8) -> SigningKey {
        SigningKey::from_bytes(&[seed; 32])
    }

    pub fn keys(seed: u8) -> Keys {
        let public = STANDARD.encode(key(seed).verifying_key().to_bytes());
        Keys::parse(&format!("k1:{public}"))
    }

    pub fn sample(script: &str, hosts: &[&str]) -> Bundle {
        Bundle {
            contract: CONTRACT,
            serial: SERIAL,
            not_after: 2_000,
            kid: "k1".into(),
            entry: "bind".into(),
            flow: Flow::CardForm,
            allowed_hosts: hosts.iter().map(|host| host.to_string()).collect(),
            page_hosts: vec![],
            result_url: RESULT_URL.into(),
            script: script.into(),
            sig: String::new(),
        }
    }

    pub fn signed(mut bundle: Bundle, key: &SigningKey) -> Bundle {
        bundle.sig = STANDARD.encode(key.sign(&bundle.signing_input()).to_bytes());
        bundle
    }

    fn good() -> Bundle {
        signed(sample("return 1", &["proxy.example"]), &key(1))
    }

    #[test]
    fn a_signed_bundle_passes() {
        assert_eq!(check(&good(), &keys(1), 1_000, SERIAL), Ok(()));
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
        assert_eq!(
            check(&good(), &keys(1), 1_000, SERIAL + 1),
            Err(Reject::OldSerial)
        );
        assert_eq!(check(&good(), &keys(1), 1_000, SERIAL), Ok(()));
    }

    #[test]
    fn a_v1_serial_or_another_contract_is_refused_even_when_signed() {
        let mut low = sample("return 1", &["proxy.example"]);
        low.serial = 1_800_000_000;
        assert_eq!(
            check(&signed(low, &key(1)), &keys(1), 1_000, 0),
            Err(Reject::Contract)
        );
        let mut other = sample("return 1", &["proxy.example"]);
        other.contract = 3;
        assert_eq!(
            check(&signed(other, &key(1)), &keys(1), 1_000, 0),
            Err(Reject::Contract)
        );
    }

    #[test]
    fn any_changed_field_breaks_the_signature() {
        let edits: [fn(&mut Bundle); 10] = [
            |b| b.script = "return 2".into(),
            |b| b.allowed_hosts.push("evil.example".into()),
            |b| b.page_hosts.push("evil.example".into()),
            |b| b.result_url = "https://evil.example/result".into(),
            |b| b.flow = Flow::Confirm,
            |b| b.serial += 1,
            |b| b.not_after = 9_999,
            |b| b.entry = "other".into(),
            |b| b.kid = "k2".into(),
            |b| b.sig.clear(),
        ];
        let both = Keys::parse(&format!(
            "k1:{},k2:{}",
            STANDARD.encode(key(1).verifying_key().to_bytes()),
            STANDARD.encode(key(1).verifying_key().to_bytes())
        ));
        for (at, edit) in edits.iter().enumerate() {
            let mut bundle = good();
            edit(&mut bundle);
            assert_eq!(
                check(&bundle, &both, 1_000, 0),
                Err(Reject::BadSignature),
                "edit {at}"
            );
        }
    }

    #[test]
    fn field_boundaries_are_not_ambiguous() {
        let mut a = sample("s", &["c.example"]);
        a.entry = "ab".into();
        let mut b = sample("s", &["bc.example"]);
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
    fn empty_host_lists_are_fine_but_bad_hosts_are_refused_even_when_signed() {
        let empty = signed(sample("return 1", &[]), &key(1));
        assert_eq!(check(&empty, &keys(1), 1_000, 0), Ok(()));
        for hosts in [
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
            let mut pages = sample("return 1", &[]);
            pages.page_hosts = hosts.iter().map(|host| host.to_string()).collect();
            assert_eq!(
                check(&signed(pages, &key(1)), &keys(1), 1_000, 0),
                Err(Reject::BadHosts),
                "{hosts:?}"
            );
        }
    }

    #[test]
    fn a_result_url_must_be_an_https_page() {
        for url in [
            "http://pay.example/r",
            "https://127.0.0.1/r",
            "javascript:1",
            "",
        ] {
            let mut bundle = sample("return 1", &[]);
            bundle.result_url = url.into();
            assert_eq!(
                check(&signed(bundle, &key(1)), &keys(1), 1_000, 0),
                Err(Reject::BadResultUrl),
                "{url}"
            );
        }
    }

    #[test]
    fn an_entry_is_a_short_plain_name() {
        for entry in ["", "../x", "Bind", &"a".repeat(33)] {
            let mut bundle = sample("return 1", &[]);
            bundle.entry = entry.into();
            assert_eq!(
                check(&signed(bundle, &key(1)), &keys(1), 1_000, 0),
                Err(Reject::Entry),
                "{entry}"
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

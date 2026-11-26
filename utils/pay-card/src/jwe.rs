use aes_gcm::Aes256Gcm;
use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng, Payload};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD as B64;
use p256::ecdh::EphemeralSecret;
use p256::elliptic_curve::sec1::{FromEncodedPoint, ToEncodedPoint};
use p256::{EncodedPoint, PublicKey};
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};
use zeroize::Zeroizing;

const ENC: &str = "A256GCM";
const KEY_BITS: u32 = 256;

#[derive(Debug, PartialEq, Eq, thiserror::Error)]
pub enum JweError {
    #[error("not a P-256 EC key")]
    Key,
    #[error("encryption failed")]
    Seal,
}

pub fn encrypt(jwk: &Value, plaintext: &[u8]) -> Result<String, JweError> {
    let recipient = public_key(jwk)?;
    let ephemeral = EphemeralSecret::random(&mut OsRng);
    let shared = ephemeral.diffie_hellman(&recipient);
    let cek = content_key(shared.raw_secret_bytes());
    let header = B64.encode(header(jwk, &ephemeral.public_key().to_encoded_point(false)));
    let iv = Aes256Gcm::generate_nonce(&mut OsRng);
    let sealed = Aes256Gcm::new_from_slice(cek.as_slice())
        .map_err(|_| JweError::Seal)?
        .encrypt(
            &iv,
            Payload {
                msg: plaintext,
                aad: header.as_bytes(),
            },
        )
        .map_err(|_| JweError::Seal)?;
    let (ciphertext, tag) = sealed.split_at(sealed.len() - 16);
    Ok(format!(
        "{header}..{}.{}.{}",
        B64.encode(iv),
        B64.encode(ciphertext),
        B64.encode(tag)
    ))
}

fn public_key(jwk: &Value) -> Result<PublicKey, JweError> {
    let text = |name: &str| jwk.get(name).and_then(Value::as_str);
    if text("kty") != Some("EC") || text("crv") != Some("P-256") {
        return Err(JweError::Key);
    }
    let coordinate = |name: &str| -> Result<[u8; 32], JweError> {
        let bytes = B64
            .decode(text(name).ok_or(JweError::Key)?)
            .map_err(|_| JweError::Key)?;
        bytes.try_into().map_err(|_| JweError::Key)
    };
    let point = EncodedPoint::from_affine_coordinates(
        &coordinate("x")?.into(),
        &coordinate("y")?.into(),
        false,
    );
    Option::from(PublicKey::from_encoded_point(&point)).ok_or(JweError::Key)
}

fn header(jwk: &Value, epk: &EncodedPoint) -> Vec<u8> {
    let mut header = Map::new();
    header.insert("alg".into(), "ECDH-ES".into());
    header.insert("enc".into(), ENC.into());
    if let Some(kid) = jwk.get("kid") {
        header.insert("kid".into(), kid.clone());
    }
    let coordinate = |bytes: Option<&p256::FieldBytes>| {
        B64.encode(bytes.map(|b| b.as_slice()).unwrap_or_default())
    };
    header.insert(
        "epk".into(),
        json!({ "kty": "EC", "crv": "P-256", "x": coordinate(epk.x()), "y": coordinate(epk.y()) }),
    );
    serde_json::to_vec(&header).unwrap_or_default()
}

fn content_key(shared: &[u8]) -> Zeroizing<[u8; 32]> {
    let mut digest = Sha256::new();
    digest.update(1u32.to_be_bytes());
    digest.update(shared);
    digest.update((ENC.len() as u32).to_be_bytes());
    digest.update(ENC.as_bytes());
    digest.update(0u32.to_be_bytes());
    digest.update(0u32.to_be_bytes());
    digest.update(KEY_BITS.to_be_bytes());
    Zeroizing::new(digest.finalize().into())
}

#[cfg(test)]
pub mod tests {
    use p256::SecretKey;
    use p256::ecdh::diffie_hellman;

    use super::*;

    const D: &str = "V_-MOVNFDvBsHAh4xaM8LRhmx1Z1DRSeTkaLai15nus";
    const X: &str = "L6CuPsTYfwK7m6JZapgE6gp98ehdKAi4Xv1SowCvLNY";
    const Y: &str = "7k1BmqE5--mzvLeSX6ET5WEgS0UQWXYKQ3VlyLWQ8tw";
    const FROM_JWCRYPTO: &str = "eyJhbGciOiJFQ0RILUVTIiwiZW5jIjoiQTI1NkdDTSIsImVwayI6eyJjcnYiOiJQLTI1NiIsImt0eSI6IkVDIiwieCI6InQ5RHdFdVVPeVUyTEhoNEIzTlhUQ2pDTHdETVQ2VTJ4RUk2aGh4UmlFYTAiLCJ5IjoiSnZ0Sl9sZjM1T3ExczUyU2w2Z3Q3U1QtUHFOaW5YLTkwckdYTlVSS1dKdyJ9LCJraWQiOjJ9..9IgTQweLmMPOhO8L.9lTIKBB2j8dXLIfc2d0Szkx9CKPLa9CL95R0kZ3fs46lMvQERMEuUK3JRZimBb6-5Nr6hD-sNGBprjI_BYVNyvvGZQLdrU5enypmU7wIkXY.QM60jeO6EyxC9_XQ3r07ag";
    const TEXT: &str =
        r#"{"card_elements":[{"ref":"cardholder","type":"cardholder","cardholder":"TEST"}]}"#;

    pub fn jwk() -> Value {
        json!({ "kid": 2, "kty": "EC", "crv": "P-256", "x": X, "y": Y })
    }

    pub fn open(compact: &str) -> (Value, Vec<u8>) {
        let parts: Vec<&str> = compact.split('.').collect();
        assert_eq!(parts.len(), 5);
        assert_eq!(parts[1], "");
        let header: Value = serde_json::from_slice(&B64.decode(parts[0]).unwrap()).unwrap();
        let epk = public_key(&header["epk"]).unwrap();
        let secret = SecretKey::from_slice(&B64.decode(D).unwrap()).unwrap();
        let shared = diffie_hellman(secret.to_nonzero_scalar(), epk.as_affine());
        let cek = content_key(shared.raw_secret_bytes());
        let mut sealed = B64.decode(parts[3]).unwrap();
        sealed.extend(B64.decode(parts[4]).unwrap());
        let iv = B64.decode(parts[2]).unwrap();
        let plain = Aes256Gcm::new_from_slice(cek.as_slice())
            .unwrap()
            .decrypt(
                iv.as_slice().into(),
                Payload {
                    msg: &sealed,
                    aad: parts[0].as_bytes(),
                },
            )
            .unwrap();
        (header, plain)
    }

    #[test]
    fn what_jwcrypto_sealed_opens_with_the_same_key_agreement() {
        let (header, plain) = open(FROM_JWCRYPTO);
        assert_eq!(header["alg"], "ECDH-ES");
        assert_eq!(plain, TEXT.as_bytes());
    }

    #[test]
    fn a_sealed_text_opens_back_and_the_header_is_the_widget_one() {
        let compact = encrypt(&jwk(), TEXT.as_bytes()).unwrap();
        let (header, plain) = open(&compact);
        assert_eq!(plain, TEXT.as_bytes());
        let mut keys: Vec<&str> = header
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        keys.sort();
        assert_eq!(keys, ["alg", "enc", "epk", "kid"]);
        assert_eq!(
            (&header["alg"], &header["enc"], &header["kid"]),
            (&json!("ECDH-ES"), &json!("A256GCM"), &json!(2))
        );
        assert!(!compact.contains("cardholder"));
    }

    #[test]
    fn each_seal_uses_a_new_ephemeral_key_and_iv() {
        let first = encrypt(&jwk(), TEXT.as_bytes()).unwrap();
        let second = encrypt(&jwk(), TEXT.as_bytes()).unwrap();
        let parts = |s: &str| s.split('.').map(String::from).collect::<Vec<_>>();
        let (a, b) = (parts(&first), parts(&second));
        assert_ne!(a[0], b[0]);
        assert_ne!(a[2], b[2]);
    }

    #[test]
    fn only_a_p256_ec_key_is_taken() {
        let mut no_kid = jwk();
        no_kid.as_object_mut().unwrap().remove("kid");
        assert!(encrypt(&no_kid, b"x").is_ok());
        for bad in [
            json!({ "kty": "RSA", "n": "AQAB", "e": "AQAB" }),
            json!({ "kty": "EC", "crv": "P-384", "x": X, "y": Y }),
            json!({ "kty": "EC", "crv": "P-256", "x": X }),
            json!({ "kty": "EC", "crv": "P-256", "x": "AAAA", "y": Y }),
            json!({ "kty": "EC", "crv": "P-256", "x": X, "y": X }),
            json!("not a key"),
        ] {
            assert_eq!(encrypt(&bad, b"x"), Err(JweError::Key), "{bad}");
        }
    }
}

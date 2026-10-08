const SEQUENCE: u8 = 0x30;
const SET: u8 = 0x31;
const OID: u8 = 0x06;
const VERSION: u8 = 0xA0;
const UTF8_STRING: u8 = 0x0C;
const PRINTABLE_STRING: u8 = 0x13;
const T61_STRING: u8 = 0x14;
const IA5_STRING: u8 = 0x16;
const BMP_STRING: u8 = 0x1E;
const COMMON_NAME: &[u8] = &[0x55, 0x04, 0x03];
const ORGANIZATION: &[u8] = &[0x55, 0x04, 0x0A];
const MAX_SUMMARY: usize = 200;

struct Tlv<'a> {
    tag: u8,
    value: &'a [u8],
    rest: &'a [u8],
}

fn tlv(input: &[u8]) -> Option<Tlv<'_>> {
    let (&tag, input) = input.split_first()?;
    let (&first, input) = input.split_first()?;
    let (len, input) = if first < 0x80 {
        (usize::from(first), input)
    } else {
        let count = usize::from(first & 0x7F);
        if count == 0 || count > 4 || input.len() < count {
            return None;
        }
        let (bytes, input) = input.split_at(count);
        let len = bytes
            .iter()
            .fold(0usize, |len, byte| (len << 8) | usize::from(*byte));
        (len, input)
    };
    if input.len() < len {
        return None;
    }
    let (value, rest) = input.split_at(len);
    Some(Tlv { tag, value, rest })
}

fn expect(input: &[u8], tag: u8) -> Option<Tlv<'_>> {
    tlv(input).filter(|found| found.tag == tag)
}

pub fn issuer_summary(cert: &[u8]) -> Option<String> {
    let certificate = expect(cert, SEQUENCE)?;
    let tbs = expect(certificate.value, SEQUENCE)?;
    let mut fields = tbs.value;
    let first = tlv(fields)?;
    if first.tag == VERSION {
        fields = first.rest;
    }
    let serial = tlv(fields)?;
    let signature = expect(serial.rest, SEQUENCE)?;
    let issuer = expect(signature.rest, SEQUENCE)?;
    let (common_name, organization) = names(issuer.value)?;
    let parts: Vec<String> = [("CN", common_name), ("O", organization)]
        .into_iter()
        .filter_map(|(label, value)| value.map(|value| format!("{label}={value}")))
        .collect();
    if parts.is_empty() {
        return None;
    }
    Some(parts.join(", ").chars().take(MAX_SUMMARY).collect())
}

fn names(mut rdns: &[u8]) -> Option<(Option<String>, Option<String>)> {
    let mut common_name = None;
    let mut organization = None;
    while !rdns.is_empty() {
        let set = expect(rdns, SET)?;
        let mut attributes = set.value;
        while !attributes.is_empty() {
            let attribute = expect(attributes, SEQUENCE)?;
            let oid = expect(attribute.value, OID)?;
            let value = tlv(oid.rest)?;
            let text = text_of(value.tag, value.value);
            match oid.value {
                COMMON_NAME => common_name = common_name.or(text),
                ORGANIZATION => organization = organization.or(text),
                _ => {}
            }
            attributes = attribute.rest;
        }
        rdns = set.rest;
    }
    Some((common_name, organization))
}

fn text_of(tag: u8, bytes: &[u8]) -> Option<String> {
    let text = match tag {
        UTF8_STRING => std::str::from_utf8(bytes).ok()?.to_string(),
        PRINTABLE_STRING | IA5_STRING | T61_STRING => {
            bytes.iter().map(|byte| char::from(*byte)).collect()
        }
        BMP_STRING if bytes.len().is_multiple_of(2) => {
            let units: Vec<u16> = bytes
                .chunks_exact(2)
                .map(|pair| u16::from_be_bytes([pair[0], pair[1]]))
                .collect();
            String::from_utf16_lossy(&units)
        }
        _ => return None,
    };
    let clean: String = text.chars().filter(|c| !c.is_control()).collect();
    let clean = clean.trim();
    (!clean.is_empty()).then(|| clean.to_string())
}

#[cfg(test)]
mod tests {
    use super::issuer_summary;

    const OTHER: &[u8] = include_bytes!("fixtures/other.der");
    const GOOD: &[u8] = include_bytes!("fixtures/good.der");

    #[test]
    fn the_issuer_names_the_interceptor() {
        assert_eq!(
            issuer_summary(OTHER).as_deref(),
            Some("CN=Test Intercept Root, O=Test Antivirus")
        );
        assert_eq!(issuer_summary(GOOD).as_deref(), Some("CN=localhost"));
    }

    #[test]
    fn a_truncated_certificate_has_no_issuer() {
        for cut in [0, 1, 4, 20, 60] {
            assert_eq!(issuer_summary(&OTHER[..cut]), None, "cut at {cut}");
        }
        assert_eq!(issuer_summary(b"not a certificate"), None);
    }

    #[test]
    fn mutated_certificates_never_panic() {
        let mut seed = 0x2545_F491_4F6C_DD1Du64;
        let mut next = || {
            seed ^= seed << 13;
            seed ^= seed >> 7;
            seed ^= seed << 17;
            seed
        };
        for _ in 0..20_000 {
            let mut bytes = OTHER.to_vec();
            for _ in 0..(next() % 6 + 1) {
                let at = (next() as usize) % bytes.len();
                bytes[at] = next() as u8;
            }
            let cut = (next() as usize) % (bytes.len() + 1);
            let summary = issuer_summary(&bytes[..cut]);
            assert!(summary.is_none_or(|text| text.chars().count() <= 200));
        }
    }
}

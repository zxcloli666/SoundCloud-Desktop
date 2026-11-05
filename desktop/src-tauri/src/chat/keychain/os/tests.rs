use super::refused;

#[cfg(target_os = "macos")]
#[test]
fn a_refused_mac_keychain_is_final_and_other_failures_are_not() {
    use keyring::macos::decode_error;
    use security_framework::base::Error;

    for code in [-128, -25293, -25308] {
        assert!(refused(&decode_error(Error::from_code(code))), "{code}");
    }
    for code in [-25300, -25291, -34018] {
        assert!(!refused(&decode_error(Error::from_code(code))), "{code}");
    }
}

#[cfg(target_os = "linux")]
#[test]
fn a_closed_unlock_prompt_is_final_and_a_locked_store_is_not() {
    use keyring::secret_service::decode_error;
    use secret_service::Error;

    assert!(refused(&decode_error(Error::Prompt)));
    assert!(!refused(&decode_error(Error::Locked)));
    assert!(!refused(&decode_error(Error::NoResult)));
}

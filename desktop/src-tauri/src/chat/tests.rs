use super::state::{DEV_KEYCHAIN_SUFFIX, KEYCHAIN_SUFFIX, RELEASE_KEYCHAIN_SUFFIX};
use super::{DEV_DIR, DIR, RELEASE_DIR};

#[test]
fn release_builds_keep_the_chat_folder_and_keychain_service_they_shipped_with() {
    assert_eq!(RELEASE_DIR, "chat");
    assert_eq!(RELEASE_KEYCHAIN_SUFFIX, ".chat");
}

#[test]
fn dev_builds_keep_their_chat_keys_and_folder_apart_from_the_release_app() {
    assert_eq!(DEV_DIR, "chat-dev");
    assert_eq!(DEV_KEYCHAIN_SUFFIX, ".chat.dev");
    let dev = cfg!(all(debug_assertions, not(feature = "chat-lab")));
    let expected = if dev {
        (DEV_DIR, DEV_KEYCHAIN_SUFFIX)
    } else {
        (RELEASE_DIR, RELEASE_KEYCHAIN_SUFFIX)
    };
    assert_eq!((DIR, KEYCHAIN_SUFFIX), expected);
}

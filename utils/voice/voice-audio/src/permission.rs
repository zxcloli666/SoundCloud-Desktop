use crate::error::{CaptureError, ErrorCode};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Permission {
    Granted,
    Denied,
    Undetermined,
    Unknown,
}

#[cfg(target_os = "macos")]
pub fn status() -> Permission {
    use objc2::msg_send;
    use objc2::runtime::AnyClass;
    use objc2_foundation::NSString;

    #[link(name = "AVFoundation", kind = "framework")]
    unsafe extern "C" {}

    let Some(class) = AnyClass::get(c"AVCaptureDevice") else {
        return Permission::Unknown;
    };
    let media = NSString::from_str("soun");
    let raw: isize = unsafe { msg_send![class, authorizationStatusForMediaType: &*media] };
    match raw {
        0 => Permission::Undetermined,
        1 | 2 => Permission::Denied,
        3 => Permission::Granted,
        _ => Permission::Unknown,
    }
}

#[cfg(not(target_os = "macos"))]
pub fn status() -> Permission {
    Permission::Unknown
}

pub fn check() -> Result<(), CaptureError> {
    match status() {
        Permission::Denied => Err(CaptureError::new(
            ErrorCode::MicDenied,
            "microphone access is denied in system settings",
        )),
        _ => Ok(()),
    }
}

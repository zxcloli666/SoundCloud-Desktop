use cpal::InterfaceType;

use crate::device::Transport;

pub fn from_interface(interface: InterfaceType, hints: &[&str]) -> Transport {
    match interface {
        InterfaceType::BuiltIn => Transport::Builtin,
        InterfaceType::Usb => Transport::Usb,
        InterfaceType::Bluetooth => Transport::Bluetooth,
        InterfaceType::Hdmi | InterfaceType::DisplayPort => Transport::Hdmi,
        InterfaceType::Virtual | InterfaceType::Aggregate => Transport::Virtual,
        _ if hints.iter().any(|h| has_bluetooth_enumerator(h)) => Transport::Bluetooth,
        _ => Transport::Unknown,
    }
}

fn has_bluetooth_enumerator(text: &str) -> bool {
    let upper = text.to_uppercase();
    ["BTHENUM", "BTHHFENUM", "BTHLEENUM", "BTHPORT"]
        .iter()
        .any(|marker| upper.contains(marker))
}

pub fn from_coreaudio(code: u32) -> Transport {
    match &code.to_be_bytes() {
        b"bltn" => Transport::Builtin,
        b"usb " => Transport::Usb,
        b"blue" | b"blea" => Transport::Bluetooth,
        b"hdmi" | b"dprt" => Transport::Hdmi,
        b"virt" | b"grup" => Transport::Virtual,
        _ => Transport::Unknown,
    }
}

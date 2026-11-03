use cpal::InterfaceType;
use voice_audio::Transport;
use voice_audio::devices::pulse;
use voice_audio::devices::transport::{from_coreaudio, from_interface};

fn code(tag: &[u8; 4]) -> u32 {
    u32::from_be_bytes(*tag)
}

#[test]
fn coreaudio_codes() {
    assert_eq!(from_coreaudio(code(b"bltn")), Transport::Builtin);
    assert_eq!(from_coreaudio(code(b"usb ")), Transport::Usb);
    assert_eq!(from_coreaudio(code(b"blue")), Transport::Bluetooth);
    assert_eq!(from_coreaudio(code(b"blea")), Transport::Bluetooth);
    assert_eq!(from_coreaudio(code(b"hdmi")), Transport::Hdmi);
    assert_eq!(from_coreaudio(code(b"dprt")), Transport::Hdmi);
    assert_eq!(from_coreaudio(code(b"virt")), Transport::Virtual);
    assert_eq!(from_coreaudio(code(b"grup")), Transport::Virtual);
    assert_eq!(from_coreaudio(code(b"airp")), Transport::Unknown);
    assert_eq!(from_coreaudio(code(b"pci ")), Transport::Unknown);
    assert_eq!(from_coreaudio(0), Transport::Unknown);
}

#[test]
fn cpal_interface_types() {
    assert_eq!(
        from_interface(InterfaceType::BuiltIn, &[]),
        Transport::Builtin
    );
    assert_eq!(from_interface(InterfaceType::Usb, &[]), Transport::Usb);
    assert_eq!(
        from_interface(InterfaceType::Bluetooth, &[]),
        Transport::Bluetooth
    );
    assert_eq!(from_interface(InterfaceType::Hdmi, &[]), Transport::Hdmi);
    assert_eq!(
        from_interface(InterfaceType::Aggregate, &[]),
        Transport::Virtual
    );
    assert_eq!(from_interface(InterfaceType::Pci, &[]), Transport::Unknown);
    assert_eq!(
        from_interface(InterfaceType::Unknown, &[]),
        Transport::Unknown
    );
}

#[test]
fn windows_instance_id_hints() {
    let hints = ["BTHENUM\\{0000111E-0000-1000-8000-00805F9B34FB}_VID&0001"];
    assert_eq!(
        from_interface(InterfaceType::Unknown, &hints),
        Transport::Bluetooth
    );
    assert_eq!(
        from_interface(InterfaceType::Unknown, &["bthhfenum\\x"]),
        Transport::Bluetooth
    );
    assert_eq!(
        from_interface(InterfaceType::Unknown, &["HDAUDIO\\FUNC_01"]),
        Transport::Unknown
    );
}

const SOURCES: &str = r#"[
 {"index":1,"name":"alsa_output.pci-0000_00_1f.3.analog-stereo.monitor","description":"Monitor of Built-in Audio","monitor_of_sink":"alsa_output.pci-0000_00_1f.3.analog-stereo","driver":"module-alsa-card.c","properties":{"device.class":"monitor"},"active_port":null},
 {"index":2,"name":"alsa_input.pci-0000_00_1f.3.analog-stereo","description":"Built-in Audio Analog Stereo","monitor_of_sink":null,"driver":"module-alsa-card.c","properties":{"device.bus":"pci","device.form_factor":"internal","device.api":"alsa"},"active_port":"analog-input-mic"},
 {"index":3,"name":"alsa_input.usb-Blue_Yeti-00.analog-stereo","description":"Yeti Stereo Microphone","monitor_of_sink":null,"driver":"module-alsa-card.c","properties":{"device.bus":"usb","device.api":"alsa"},"active_port":"analog-input-mic"},
 {"index":4,"name":"bluez_input.AA_BB_CC_DD_EE_FF.0","description":"AirPods Pro","monitor_of_sink":null,"driver":"module-bluez5-device.c","properties":{"device.api":"bluez5","device.form_factor":"headset"},"active_port":null},
 {"index":5,"name":"alsa_input.pci-0000_01_00.1.hdmi-stereo","description":"HDMI Input","monitor_of_sink":null,"driver":"module-alsa-card.c","properties":{"device.bus":"pci"},"active_port":"hdmi-input"},
 {"index":6,"name":"nullsrc","description":"Null","monitor_of_sink":null,"driver":"module-null-sink.c","properties":{"device.class":"abstract"},"active_port":null},
 {"index":7,"name":"mystery","description":"Mystery","monitor_of_sink":null,"driver":"module-x.c","properties":{},"active_port":null}
]"#;

const SINKS: &str = r#"[
 {"index":1,"name":"alsa_output.pci-0000_00_1f.3.analog-stereo","description":"Built-in Audio Analog Stereo","driver":"module-alsa-card.c","properties":{"device.bus":"pci","device.form_factor":"internal"},"active_port":"analog-output-speaker"},
 {"index":2,"name":"bluez_output.AA_BB_CC_DD_EE_FF.1","description":"AirPods Pro","driver":"module-bluez5-device.c","properties":{"device.api":"bluez5"},"active_port":null}
]"#;

#[test]
fn pactl_json_maps_transports_and_skips_monitors() {
    let list = pulse::parse(
        SOURCES,
        SINKS,
        "alsa_input.pci-0000_00_1f.3.analog-stereo",
        "bluez_output.AA_BB_CC_DD_EE_FF.1",
    )
    .unwrap();
    let got: Vec<(&str, Transport, bool)> = list
        .inputs
        .iter()
        .map(|d| (d.name.as_str(), d.transport, d.default))
        .collect();
    assert_eq!(
        got,
        [
            ("Built-in Audio Analog Stereo", Transport::Builtin, true),
            ("Yeti Stereo Microphone", Transport::Usb, false),
            ("AirPods Pro", Transport::Bluetooth, false),
            ("HDMI Input", Transport::Hdmi, false),
            ("Null", Transport::Virtual, false),
            ("Mystery", Transport::Unknown, false),
        ]
    );
    assert_eq!(
        list.inputs[0].id,
        "pa:alsa_input.pci-0000_00_1f.3.analog-stereo"
    );
    assert_eq!(list.outputs.len(), 2);
    assert_eq!(list.outputs[1].transport, Transport::Bluetooth);
    assert!(list.outputs[1].default);
    assert!(!list.outputs[0].default);
}

#[test]
fn pactl_garbage_is_none() {
    assert!(pulse::parse("not json", "[]", "", "").is_none());
}

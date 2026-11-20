use voice_audio::device::{Device, Transport};
use voice_audio::routing::{
    EchoMode, ListenMode, OutputInfo, Purpose, core_name, echo_on, pick_inputs, same_physical,
};

fn dev(id: &str, name: &str, transport: Transport, default: bool) -> Device {
    Device {
        id: id.into(),
        name: name.into(),
        transport,
        default,
        group: None,
    }
}

fn inputs() -> Vec<Device> {
    vec![
        dev("bt", "AirPods Pro", Transport::Bluetooth, true),
        dev("mac", "MacBook Pro Microphone", Transport::Builtin, false),
        dev("usb", "Blue Yeti", Transport::Usb, false),
        dev("loop", "BlackHole 2ch", Transport::Virtual, false),
    ]
}

fn out(name: &str, transport: Transport, headphones: bool) -> OutputInfo {
    OutputInfo {
        name: name.into(),
        transport,
        headphones,
        group: None,
    }
}

fn ids(devices: &[Device]) -> Vec<&str> {
    devices.iter().map(|d| d.id.as_str()).collect()
}

#[test]
fn chosen_set_keeps_listed_inputs() {
    let chosen = vec!["usb".to_string(), "mac".to_string()];
    let got = pick_inputs(
        ListenMode::Chosen,
        &chosen,
        &inputs(),
        None,
        Purpose::Utterance,
    );
    assert_eq!(ids(&got), ["mac", "usb"]);
}

#[test]
fn chosen_empty_falls_back_to_plain_default() {
    let got = pick_inputs(ListenMode::Chosen, &[], &inputs(), None, Purpose::Utterance);
    assert_eq!(ids(&got), ["mac"]);
}

#[test]
fn chosen_gone_falls_back() {
    let chosen = vec!["unplugged".to_string()];
    let got = pick_inputs(
        ListenMode::Chosen,
        &chosen,
        &inputs(),
        None,
        Purpose::Utterance,
    );
    assert_eq!(ids(&got), ["mac"]);
}

#[test]
fn where_i_speak_matches_output_by_name_and_transport() {
    let output = out("MacBook Pro Speakers", Transport::Builtin, false);
    let got = pick_inputs(
        ListenMode::WhereISpeak,
        &[],
        &inputs(),
        Some(&output),
        Purpose::Utterance,
    );
    assert_eq!(ids(&got), ["mac"]);

    let output = out("AirPods Pro", Transport::Bluetooth, true);
    let got = pick_inputs(
        ListenMode::WhereISpeak,
        &[],
        &inputs(),
        Some(&output),
        Purpose::Utterance,
    );
    assert_eq!(ids(&got), ["bt"]);
}

#[test]
fn where_i_speak_does_not_match_other_transport() {
    let output = out("MacBook Pro Speakers", Transport::Usb, false);
    let got = pick_inputs(
        ListenMode::WhereISpeak,
        &[],
        &inputs(),
        Some(&output),
        Purpose::Utterance,
    );
    assert_eq!(ids(&got), ["mac"]);
}

#[test]
fn where_i_speak_without_match_uses_default_input() {
    let list = vec![
        dev("a", "Webcam Mic", Transport::Usb, true),
        dev("b", "Other", Transport::Builtin, false),
    ];
    let output = out("TV", Transport::Hdmi, false);
    let got = pick_inputs(
        ListenMode::WhereISpeak,
        &[],
        &list,
        Some(&output),
        Purpose::Utterance,
    );
    assert_eq!(ids(&got), ["a"]);
}

#[test]
fn everywhere_skips_virtual_inputs() {
    let got = pick_inputs(
        ListenMode::Everywhere,
        &[],
        &inputs(),
        None,
        Purpose::Utterance,
    );
    assert_eq!(ids(&got), ["bt", "mac", "usb"]);
}

#[test]
fn bluetooth_opens_for_utterance_only() {
    let got = pick_inputs(
        ListenMode::Everywhere,
        &[],
        &inputs(),
        None,
        Purpose::Utterance,
    );
    assert!(got.iter().any(|d| d.transport == Transport::Bluetooth));
    for purpose in [Purpose::Wake, Purpose::Meter] {
        let got = pick_inputs(ListenMode::Everywhere, &[], &inputs(), None, purpose);
        assert_eq!(ids(&got), ["mac", "usb"]);
    }
}

#[test]
fn wake_never_picks_bluetooth_even_when_chosen() {
    let chosen = vec!["bt".to_string()];
    let got = pick_inputs(ListenMode::Chosen, &chosen, &inputs(), None, Purpose::Wake);
    assert_eq!(ids(&got), ["mac"]);
}

#[test]
fn bluetooth_only_machine_has_no_wake_input() {
    let list = vec![dev("bt", "AirPods", Transport::Bluetooth, true)];
    assert!(pick_inputs(ListenMode::Everywhere, &[], &list, None, Purpose::Wake).is_empty());
    assert_eq!(
        pick_inputs(ListenMode::Everywhere, &[], &list, None, Purpose::Utterance).len(),
        1
    );
}

#[test]
fn echo_auto_decisions() {
    let mac = dev("mac", "MacBook Pro Microphone", Transport::Builtin, true);
    let usb = dev("usb", "Yeti", Transport::Usb, false);
    let bt = dev("bt", "AirPods", Transport::Bluetooth, false);
    let virt = dev("v", "BlackHole", Transport::Virtual, false);
    let unknown = dev("u", "Mic", Transport::Unknown, false);
    let speakers = out("Speakers", Transport::Builtin, false);
    let external = out("Monitor", Transport::Hdmi, false);
    let headphones = out("Headphones", Transport::Builtin, true);
    let bt_out = out("AirPods", Transport::Bluetooth, false);

    assert!(echo_on(EchoMode::Auto, &mac, Some(&speakers)));
    assert!(echo_on(EchoMode::Auto, &usb, Some(&speakers)));
    assert!(echo_on(EchoMode::Auto, &mac, Some(&external)));
    assert!(echo_on(EchoMode::Auto, &unknown, Some(&speakers)));
    assert!(echo_on(EchoMode::Auto, &mac, None));
    assert!(!echo_on(EchoMode::Auto, &mac, Some(&headphones)));
    assert!(!echo_on(EchoMode::Auto, &usb, Some(&bt_out)));
    assert!(!echo_on(EchoMode::Auto, &bt, Some(&speakers)));
    assert!(!echo_on(EchoMode::Auto, &virt, Some(&speakers)));
}

#[test]
fn echo_force_modes() {
    let bt = dev("bt", "AirPods", Transport::Bluetooth, false);
    let mac = dev("mac", "Mic", Transport::Builtin, false);
    let headphones = out("Headphones", Transport::Builtin, true);
    assert!(echo_on(EchoMode::On, &bt, Some(&headphones)));
    assert!(!echo_on(EchoMode::Off, &mac, None));
}

#[test]
fn core_names_pair_inputs_with_outputs() {
    assert_eq!(
        core_name("MacBook Pro Microphone"),
        core_name("MacBook Pro Speakers")
    );
    assert_eq!(
        core_name("Microphone (Realtek Audio)"),
        core_name("Speakers (Realtek Audio)")
    );
    assert_eq!(
        core_name("Headset (AirPods Pro Hands-Free AG Audio)"),
        core_name("Headphones (AirPods Pro)")
    );
    assert_ne!(core_name("Blue Yeti"), core_name("MacBook Pro Speakers"));
    assert_eq!(core_name("Microphone"), "");
}

#[test]
fn same_physical_needs_nonempty_name() {
    let input = dev("i", "Microphone", Transport::Builtin, false);
    let output = out("Speakers", Transport::Builtin, false);
    assert!(!same_physical(&input, &output));
}

#[test]
fn group_or_name_pairs_input_with_output() {
    let mut mic = dev("m", "Микрофон MacBook Air", Transport::Builtin, true);
    mic.group = Some("BuiltInSpeakerDevice".into());
    let mut speakers = out("Динамики MacBook Air", Transport::Builtin, false);
    speakers.group = Some("BuiltInSpeakerDevice".into());
    assert!(same_physical(&mic, &speakers));
    speakers.group = Some("other".into());
    assert!(!same_physical(&mic, &speakers));
    let mut bt_in = dev("i", "JBL Tune 520BT", Transport::Bluetooth, true);
    bt_in.group = Some("B8:input".into());
    let mut bt_out = out("JBL Tune 520BT", Transport::Bluetooth, false);
    bt_out.group = Some("B8:output".into());
    assert!(same_physical(&bt_in, &bt_out));
}

#[test]
fn output_info_comes_from_the_list() {
    use voice_audio::DeviceList;
    let mut speaker = dev("o", "Speakers", Transport::Usb, false);
    speaker.group = Some("g".into());
    let list = DeviceList {
        inputs: Vec::new(),
        outputs: vec![speaker],
    };
    let info = list.output_info("o", true).unwrap();
    assert_eq!(info.transport, Transport::Usb);
    assert!(info.headphones);
    assert_eq!(info.group.as_deref(), Some("g"));
    assert!(list.output_info("x", false).is_none());
}

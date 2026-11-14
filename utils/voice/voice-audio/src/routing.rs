use crate::device::{Device, Transport};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ListenMode {
    Chosen,
    WhereISpeak,
    Everywhere,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Purpose {
    Utterance,
    Wake,
    Meter,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EchoMode {
    Auto,
    On,
    Off,
}

#[derive(Clone, Debug, PartialEq)]
pub struct OutputInfo {
    pub name: String,
    pub transport: Transport,
    pub headphones: bool,
    pub group: Option<String>,
}

pub fn pick_inputs(
    mode: ListenMode,
    chosen: &[String],
    inputs: &[Device],
    output: Option<&OutputInfo>,
    purpose: Purpose,
) -> Vec<Device> {
    let mut picked: Vec<Device> = match mode {
        ListenMode::Chosen => inputs
            .iter()
            .filter(|d| chosen.contains(&d.id))
            .cloned()
            .collect(),
        ListenMode::WhereISpeak => output
            .and_then(|out| inputs.iter().find(|d| same_physical(d, out)))
            .cloned()
            .into_iter()
            .collect(),
        ListenMode::Everywhere => inputs
            .iter()
            .filter(|d| d.transport != Transport::Virtual)
            .cloned()
            .collect(),
    };
    if purpose != Purpose::Utterance {
        picked.retain(|d| d.transport != Transport::Bluetooth);
    }
    if picked.is_empty() {
        picked.extend(default_input(inputs, purpose));
    }
    picked
}

fn default_input(inputs: &[Device], purpose: Purpose) -> Option<Device> {
    let allowed =
        |d: &&Device| purpose == Purpose::Utterance || d.transport != Transport::Bluetooth;
    let plain = |d: &&Device| matches!(d.transport, Transport::Builtin | Transport::Usb);
    inputs
        .iter()
        .filter(allowed)
        .find(|d| d.default && plain(d))
        .or_else(|| inputs.iter().filter(allowed).find(plain))
        .or_else(|| inputs.iter().filter(allowed).find(|d| d.default))
        .or_else(|| inputs.iter().find(allowed))
        .cloned()
}

pub fn same_physical(input: &Device, output: &OutputInfo) -> bool {
    if input.group.is_some() && input.group == output.group {
        return true;
    }
    if input.transport != output.transport {
        return false;
    }
    let a = core_name(&input.name);
    !a.is_empty() && a == core_name(&output.name)
}

const ROLE_WORDS: &[&str] = &[
    "microphone",
    "microphones",
    "mic",
    "speaker",
    "speakers",
    "headphones",
    "headphone",
    "headset",
    "input",
    "output",
    "line",
    "in",
    "out",
    "stereo",
    "mono",
    "analog",
    "digital",
    "array",
    "hands-free",
    "ag",
    "audio",
];

pub fn core_name(name: &str) -> String {
    let inside = name
        .rfind('(')
        .and_then(|open| name[open + 1..].split(')').next())
        .filter(|inner| !inner.trim().is_empty());
    let base = inside.unwrap_or(name);
    base.to_lowercase()
        .split(|c: char| !c.is_alphanumeric() && c != '-')
        .filter(|w| !w.is_empty() && !ROLE_WORDS.contains(w))
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn echo_on(mode: EchoMode, input: &Device, output: Option<&OutputInfo>) -> bool {
    match mode {
        EchoMode::On => true,
        EchoMode::Off => false,
        EchoMode::Auto => {
            if matches!(input.transport, Transport::Bluetooth | Transport::Virtual) {
                return false;
            }
            match output {
                Some(out) => !out.headphones && out.transport != Transport::Bluetooth,
                None => true,
            }
        }
    }
}

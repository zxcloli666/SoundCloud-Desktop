use serde_json::Value;

use crate::device::{Device, DeviceList, Transport};

pub const ID_PREFIX: &str = "pa:";

pub fn list() -> Option<DeviceList> {
    let sources = pactl(&["-f", "json", "list", "sources"])?;
    let sinks = pactl(&["-f", "json", "list", "sinks"])?;
    let default_source = pactl(&["get-default-source"]).unwrap_or_default();
    let default_sink = pactl(&["get-default-sink"]).unwrap_or_default();
    parse(&sources, &sinks, default_source.trim(), default_sink.trim())
}

fn pactl(args: &[&str]) -> Option<String> {
    let out = std::process::Command::new("pactl")
        .args(args)
        .env("LC_ALL", "C")
        .output()
        .ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

pub fn parse(
    sources: &str,
    sinks: &str,
    default_source: &str,
    default_sink: &str,
) -> Option<DeviceList> {
    Some(DeviceList {
        inputs: parse_side(sources, default_source, true)?,
        outputs: parse_side(sinks, default_sink, false)?,
    })
}

fn parse_side(json: &str, default_name: &str, input: bool) -> Option<Vec<Device>> {
    let items: Vec<Value> = serde_json::from_str(json).ok()?;
    let mut devices = Vec::new();
    for item in &items {
        let name = item["name"].as_str()?;
        if input && is_monitor(item, name) {
            continue;
        }
        devices.push(Device {
            id: format!("{ID_PREFIX}{name}"),
            name: item["description"].as_str().unwrap_or(name).to_string(),
            transport: transport(item, name),
            default: name == default_name,
            group: group(item),
        });
    }
    Some(devices)
}

fn is_monitor(item: &Value, name: &str) -> bool {
    !item["monitor_of_sink"].is_null() || name.ends_with(".monitor")
}

fn transport(item: &Value, name: &str) -> Transport {
    let props = &item["properties"];
    let prop = |key: &str| props[key].as_str().unwrap_or("").to_lowercase();
    let bus = prop("device.bus");
    let api = prop("device.api");
    let class = prop("device.class");
    let form = prop("device.form_factor");
    let driver = item["driver"].as_str().unwrap_or("").to_lowercase();
    let lower = name.to_lowercase();
    let port = item["active_port"].as_str().unwrap_or("").to_lowercase();

    if api == "bluez5" || bus == "bluetooth" || lower.starts_with("bluez_") {
        Transport::Bluetooth
    } else if bus == "usb" {
        Transport::Usb
    } else if lower.contains("hdmi") || port.contains("hdmi") {
        Transport::Hdmi
    } else if matches!(class.as_str(), "abstract" | "filter" | "loopback")
        || driver.contains("module-null-sink")
        || driver.contains("module-virtual")
        || driver.contains("module-loopback")
        || driver.contains("module-combine")
    {
        Transport::Virtual
    } else if bus == "pci" || form == "internal" {
        Transport::Builtin
    } else {
        Transport::Unknown
    }
}

fn group(item: &Value) -> Option<String> {
    let props = &item["properties"];
    ["api.bluez5.address", "device.bus_path", "alsa.card_name"]
        .iter()
        .find_map(|key| props[key].as_str())
        .filter(|v| !v.is_empty())
        .map(str::to_string)
}

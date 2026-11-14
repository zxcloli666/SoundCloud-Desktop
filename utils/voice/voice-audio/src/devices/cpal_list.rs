use cpal::traits::{DeviceTrait, HostTrait};

use crate::device::{Device, DeviceList};

use super::transport;

pub fn list() -> DeviceList {
    let host = cpal::default_host();
    let default_input = default_id(host.default_input_device());
    let default_output = default_id(host.default_output_device());
    let inputs = host
        .input_devices()
        .map(|found| found.collect::<Vec<_>>())
        .unwrap_or_default();
    let outputs = host
        .output_devices()
        .map(|found| found.collect::<Vec<_>>())
        .unwrap_or_default();
    DeviceList {
        inputs: describe(inputs, &default_input),
        outputs: describe(outputs, &default_output),
    }
}

fn default_id(device: Option<cpal::Device>) -> Option<String> {
    device.and_then(|d| d.id().ok()).map(|id| id.to_string())
}

fn describe(devices: Vec<cpal::Device>, default: &Option<String>) -> Vec<Device> {
    let mut out: Vec<Device> = Vec::new();
    for device in devices {
        let Ok(id) = device.id() else { continue };
        let Ok(description) = device.description() else {
            continue;
        };
        let id_text = id.to_string();
        if out.iter().any(|d| d.id == id_text) {
            continue;
        }
        let mut hints: Vec<&str> = description.extended().iter().map(String::as_str).collect();
        hints.extend(description.driver());
        hints.extend(description.address());
        out.push(Device {
            default: default.as_deref() == Some(id_text.as_str()),
            name: description.name().to_string(),
            transport: transport::from_interface(description.interface_type(), &hints),
            id: id_text,
            group: None,
        });
    }
    out
}

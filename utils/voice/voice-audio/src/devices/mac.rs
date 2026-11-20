use std::mem::size_of;
use std::ptr::{NonNull, null};

use objc2_core_audio::{
    AudioDeviceID, AudioObjectGetPropertyData, AudioObjectGetPropertyDataSize, AudioObjectID,
    AudioObjectPropertyAddress, AudioObjectPropertyScope, kAudioDevicePropertyDeviceUID,
    kAudioDevicePropertyRelatedDevices, kAudioDevicePropertyStreams,
    kAudioDevicePropertyTransportType, kAudioHardwarePropertyDefaultInputDevice,
    kAudioHardwarePropertyDefaultOutputDevice, kAudioHardwarePropertyDevices,
    kAudioObjectPropertyElementMain, kAudioObjectPropertyName, kAudioObjectPropertyScopeGlobal,
    kAudioObjectPropertyScopeInput, kAudioObjectPropertyScopeOutput, kAudioObjectSystemObject,
};
use objc2_core_foundation::{CFRetained, CFString};

use crate::device::{Device, DeviceList};

use super::transport::from_coreaudio;

pub fn list() -> DeviceList {
    let default_input = default_device(kAudioHardwarePropertyDefaultInputDevice);
    let default_output = default_device(kAudioHardwarePropertyDefaultOutputDevice);
    let mut list = DeviceList::default();
    for id in device_ids() {
        let (Some(uid), Some(name)) = (string(id, kAudioDevicePropertyDeviceUID), name(id)) else {
            continue;
        };
        let transport = from_coreaudio(transport_code(id).unwrap_or(0));
        let group = group(id).or_else(|| Some(uid.clone()));
        let device = |default: Option<AudioDeviceID>| Device {
            id: cpal::DeviceId(cpal::HostId::CoreAudio, uid.clone()).to_string(),
            name: name.clone(),
            transport,
            default: default == Some(id),
            group: group.clone(),
        };
        if has_streams(id, kAudioObjectPropertyScopeInput) {
            list.inputs.push(device(default_input));
        }
        if has_streams(id, kAudioObjectPropertyScopeOutput) {
            list.outputs.push(device(default_output));
        }
    }
    list
}

fn address(selector: u32, scope: AudioObjectPropertyScope) -> AudioObjectPropertyAddress {
    AudioObjectPropertyAddress {
        mSelector: selector,
        mScope: scope,
        mElement: kAudioObjectPropertyElementMain,
    }
}

fn global(selector: u32) -> AudioObjectPropertyAddress {
    address(selector, kAudioObjectPropertyScopeGlobal)
}

fn device_ids() -> Vec<AudioDeviceID> {
    id_list(
        kAudioObjectSystemObject as AudioObjectID,
        kAudioHardwarePropertyDevices,
    )
}

fn group(id: AudioDeviceID) -> Option<String> {
    id_list(id, kAudioDevicePropertyRelatedDevices)
        .into_iter()
        .filter_map(|related| string(related, kAudioDevicePropertyDeviceUID))
        .min()
}

fn id_list(system: AudioObjectID, selector: u32) -> Vec<AudioDeviceID> {
    let address = global(selector);
    let mut size = 0u32;
    let status = unsafe {
        AudioObjectGetPropertyDataSize(
            system,
            NonNull::from(&address),
            0,
            null(),
            NonNull::from(&mut size),
        )
    };
    if status != 0 {
        return Vec::new();
    }
    let mut ids = vec![0 as AudioDeviceID; size as usize / size_of::<AudioDeviceID>()];
    let status = unsafe {
        AudioObjectGetPropertyData(
            system,
            NonNull::from(&address),
            0,
            null(),
            NonNull::from(&mut size),
            NonNull::from(&mut ids[..]).cast(),
        )
    };
    if status != 0 {
        return Vec::new();
    }
    ids
}

fn default_device(selector: u32) -> Option<AudioDeviceID> {
    let address = global(selector);
    let mut id: AudioDeviceID = 0;
    let mut size = size_of::<AudioDeviceID>() as u32;
    let status = unsafe {
        AudioObjectGetPropertyData(
            kAudioObjectSystemObject as AudioObjectID,
            NonNull::from(&address),
            0,
            null(),
            NonNull::from(&mut size),
            NonNull::from(&mut id).cast(),
        )
    };
    (status == 0 && id != 0).then_some(id)
}

fn has_streams(id: AudioDeviceID, scope: AudioObjectPropertyScope) -> bool {
    let address = address(kAudioDevicePropertyStreams, scope);
    let mut size = 0u32;
    let status = unsafe {
        AudioObjectGetPropertyDataSize(
            id,
            NonNull::from(&address),
            0,
            null(),
            NonNull::from(&mut size),
        )
    };
    status == 0 && size > 0
}

fn transport_code(id: AudioDeviceID) -> Option<u32> {
    let address = global(kAudioDevicePropertyTransportType);
    let mut code = 0u32;
    let mut size = size_of::<u32>() as u32;
    let status = unsafe {
        AudioObjectGetPropertyData(
            id,
            NonNull::from(&address),
            0,
            null(),
            NonNull::from(&mut size),
            NonNull::from(&mut code).cast(),
        )
    };
    (status == 0).then_some(code)
}

fn name(id: AudioDeviceID) -> Option<String> {
    string(id, kAudioObjectPropertyName)
}

fn string(id: AudioDeviceID, selector: u32) -> Option<String> {
    let address = global(selector);
    let mut raw: *mut CFString = std::ptr::null_mut();
    let mut size = size_of::<*mut CFString>() as u32;
    let status = unsafe {
        AudioObjectGetPropertyData(
            id,
            NonNull::from(&address),
            0,
            null(),
            NonNull::from(&mut size),
            NonNull::from(&mut raw).cast(),
        )
    };
    if status != 0 {
        return None;
    }
    let owned = unsafe { CFRetained::from_raw(NonNull::new(raw)?) };
    Some(owned.to_string())
}

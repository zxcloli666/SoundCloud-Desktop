use sc_chat::{ChatConfig, ChatResult, Device, DeviceId};

use crate::chat::runtime::config_of;
use crate::chat::state::ChatState;

pub async fn config(state: &ChatState) -> ChatResult<ChatConfig> {
    match state.api.config().await {
        Ok(view) => Ok(config_of(view)),
        Err(error) => state.runtime.config().ok_or(error),
    }
}

pub async fn list(state: &ChatState) -> ChatResult<Vec<Device>> {
    let devices = state.core()?.sync.devices().await?;
    if let Some(me) = devices.iter().find(|device| device.current) {
        state.runtime.adopt_device(me.id);
    }
    Ok(devices)
}

pub async fn confirm(state: &ChatState, device_id: DeviceId) -> ChatResult<()> {
    state.api.confirm_device(device_id).await
}

pub async fn not_me(state: &ChatState, device_id: DeviceId) -> ChatResult<()> {
    state.api.device_not_me(device_id).await
}

pub async fn remove(state: &ChatState, device_id: DeviceId) -> ChatResult<()> {
    if state.status().device_id == Some(device_id) {
        return logout(state).await;
    }
    state.api.remove_device(device_id).await
}

pub async fn logout(state: &ChatState) -> ChatResult<()> {
    let _ = state.api.remove_this_device().await;
    state.log_out().await
}

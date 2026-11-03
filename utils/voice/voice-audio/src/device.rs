#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Transport {
    Builtin,
    Usb,
    Bluetooth,
    Hdmi,
    Virtual,
    Unknown,
}

impl Transport {
    pub fn as_str(self) -> &'static str {
        match self {
            Transport::Builtin => "builtin",
            Transport::Usb => "usb",
            Transport::Bluetooth => "bluetooth",
            Transport::Hdmi => "hdmi",
            Transport::Virtual => "virtual",
            Transport::Unknown => "unknown",
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub transport: Transport,
    pub default: bool,
    pub group: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct DeviceList {
    pub inputs: Vec<Device>,
    pub outputs: Vec<Device>,
}

impl DeviceList {
    pub fn input(&self, id: &str) -> Option<&Device> {
        self.inputs.iter().find(|d| d.id == id)
    }

    pub fn output(&self, id: &str) -> Option<&Device> {
        self.outputs.iter().find(|d| d.id == id)
    }

    pub fn output_info(&self, id: &str, headphones: bool) -> Option<crate::routing::OutputInfo> {
        self.output(id).map(|d| crate::routing::OutputInfo {
            name: d.name.clone(),
            transport: d.transport,
            headphones,
            group: d.group.clone(),
        })
    }
}

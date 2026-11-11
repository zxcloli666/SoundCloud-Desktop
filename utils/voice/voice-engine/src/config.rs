use serde::Deserialize;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Language {
    #[default]
    Ru,
    En,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Headset {
    #[default]
    Off,
    Double,
    Triple,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ListenMode {
    #[default]
    Chosen,
    WhereISpeak,
    Everywhere,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SpeakMode {
    #[default]
    WithMusic,
    Device,
    WhereIListen,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Echo {
    #[default]
    Auto,
    On,
    Off,
}

#[derive(Clone, Debug, Default, PartialEq, Deserialize)]
#[serde(default)]
pub struct Wake {
    pub on: bool,
    pub phrase: String,
    pub sensitivity: f32,
}

#[derive(Clone, Debug, PartialEq, Deserialize)]
#[serde(default)]
pub struct Activation {
    pub hotkey: Option<String>,
    pub hold: bool,
    pub headset: Headset,
    pub wake: Wake,
}

#[derive(Clone, Debug, Default, PartialEq, Deserialize)]
#[serde(default)]
pub struct Listen {
    pub mode: ListenMode,
    pub devices: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Deserialize)]
#[serde(default)]
pub struct Speak {
    pub mode: SpeakMode,
    pub device: Option<String>,
    pub voice: String,
    pub speed: f32,
    pub pitch: f32,
    pub replies: bool,
}

#[derive(Clone, Debug, Default, PartialEq, Deserialize)]
#[serde(default)]
pub struct Boosts {
    pub artists: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Deserialize)]
#[serde(default)]
pub struct Config {
    pub enabled: bool,
    pub language: Language,
    pub activation: Activation,
    pub listen: Listen,
    pub speak: Speak,
    pub duck: f32,
    pub echo: Echo,
    pub llm: bool,
    pub boosts: Boosts,
}

impl Default for Activation {
    fn default() -> Self {
        Self {
            hotkey: None,
            hold: true,
            headset: Headset::Off,
            wake: Wake::default(),
        }
    }
}

impl Default for Speak {
    fn default() -> Self {
        Self {
            mode: SpeakMode::WithMusic,
            device: None,
            voice: crate::voices::DEFAULT.into(),
            speed: 1.0,
            pitch: 0.0,
            replies: true,
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            enabled: false,
            language: Language::Ru,
            activation: Activation::default(),
            listen: Listen::default(),
            speak: Speak::default(),
            duck: 0.3,
            echo: Echo::Auto,
            llm: false,
            boosts: Boosts::default(),
        }
    }
}

impl Headset {
    pub fn presses(self) -> u8 {
        match self {
            Headset::Off => 0,
            Headset::Double => 2,
            Headset::Triple => 3,
        }
    }
}

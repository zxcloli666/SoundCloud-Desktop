use std::sync::OnceLock;

use serde::Deserialize;

pub const LOCALES: [(&str, &str); 4] = [
    (
        "en",
        include_str!("../../../../src/i18n/locales/chat/alerts.en.json"),
    ),
    (
        "ru",
        include_str!("../../../../src/i18n/locales/chat/alerts.ru.json"),
    ),
    (
        "tr",
        include_str!("../../../../src/i18n/locales/chat/alerts.tr.json"),
    ),
    (
        "ko",
        include_str!("../../../../src/i18n/locales/chat/alerts.ko.json"),
    ),
];

static PARSED: OnceLock<Vec<Strings>> = OnceLock::new();

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Strings {
    pub new_message: String,
    pub kicked: String,
    pub removed: String,
    pub banned: String,
    pub muted: String,
    pub host: String,
    pub chat: String,
    pub group: String,
    #[serde(default)]
    pub public: String,
    pub room: String,
    pub track: String,
    pub playlist: String,
    pub profile: String,
    pub photo: String,
    pub photos: String,
    pub room_invite: String,
    pub device_title: String,
    pub device_body: String,
}

pub fn get(language: &str) -> &'static Strings {
    let all = PARSED.get_or_init(|| {
        LOCALES
            .iter()
            .map(|(_, raw)| serde_json::from_str(raw).unwrap_or_default())
            .collect()
    });
    let code = language.split('-').next().unwrap_or(language);
    let index = LOCALES
        .iter()
        .position(|(known, _)| *known == code)
        .unwrap_or(0);
    &all[index]
}

#[derive(serde::Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Request {
    YmLikes {
        token: String,
    },
    YmPlaylist {
        token: String,
        owner: String,
        playlist: String,
    },
    Link {
        url: String,
        token: Option<String>,
    },
    Text {
        text: String,
    },
}

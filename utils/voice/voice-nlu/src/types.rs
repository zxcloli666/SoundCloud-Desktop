use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Intent {
    Play,
    Pause,
    Resume,
    Stop,
    Next,
    Previous,
    SeekForward,
    SeekBackward,
    SeekTo,
    VolumeUp,
    VolumeDown,
    VolumeSet,
    Mute,
    Unmute,
    Like,
    Unlike,
    ShuffleOn,
    ShuffleOff,
    RepeatOne,
    RepeatAll,
    RepeatOff,
    QueueAdd,
    NowPlaying,
    PlayLikes,
    PlayWave,
    PlaySimilar,
    Undo,
    Help,
    None,
}

const INTENT_NAMES: [(Intent, &str); 29] = [
    (Intent::Play, "play"),
    (Intent::Pause, "pause"),
    (Intent::Resume, "resume"),
    (Intent::Stop, "stop"),
    (Intent::Next, "next"),
    (Intent::Previous, "previous"),
    (Intent::SeekForward, "seek_forward"),
    (Intent::SeekBackward, "seek_backward"),
    (Intent::SeekTo, "seek_to"),
    (Intent::VolumeUp, "volume_up"),
    (Intent::VolumeDown, "volume_down"),
    (Intent::VolumeSet, "volume_set"),
    (Intent::Mute, "mute"),
    (Intent::Unmute, "unmute"),
    (Intent::Like, "like"),
    (Intent::Unlike, "unlike"),
    (Intent::ShuffleOn, "shuffle_on"),
    (Intent::ShuffleOff, "shuffle_off"),
    (Intent::RepeatOne, "repeat_one"),
    (Intent::RepeatAll, "repeat_all"),
    (Intent::RepeatOff, "repeat_off"),
    (Intent::QueueAdd, "queue_add"),
    (Intent::NowPlaying, "now_playing"),
    (Intent::PlayLikes, "play_likes"),
    (Intent::PlayWave, "play_wave"),
    (Intent::PlaySimilar, "play_similar"),
    (Intent::Undo, "undo"),
    (Intent::Help, "help"),
    (Intent::None, "none"),
];

impl Intent {
    pub fn name(self) -> &'static str {
        INTENT_NAMES.iter().find(|(i, _)| *i == self).unwrap().1
    }

    pub fn from_name(name: &str) -> Option<Intent> {
        INTENT_NAMES
            .iter()
            .find(|(_, n)| *n == name)
            .map(|(i, _)| *i)
    }

    pub fn needs_entity(self) -> bool {
        matches!(self, Intent::Play | Intent::QueueAdd)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Kind {
    Track,
    Artist,
    Album,
    Playlist,
}

impl Kind {
    pub const ALL: [Kind; 4] = [Kind::Artist, Kind::Track, Kind::Album, Kind::Playlist];

    pub fn name(self) -> &'static str {
        match self {
            Kind::Track => "track",
            Kind::Artist => "artist",
            Kind::Album => "album",
            Kind::Playlist => "playlist",
        }
    }

    pub fn from_name(name: &str) -> Option<Kind> {
        Kind::ALL.into_iter().find(|k| k.name() == name)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
pub struct Variant {
    pub text: String,
    pub artist: Option<String>,
    pub title: Option<String>,
    pub kept_fillers: bool,
    pub lemmatized: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Parsed {
    pub intent: Intent,
    pub kind_hint: Option<Kind>,
    pub queries: Vec<Variant>,
    pub number: Option<u32>,
    pub heard: String,
    pub normalized: String,
    pub bare: bool,
    pub weak_verb: bool,
}

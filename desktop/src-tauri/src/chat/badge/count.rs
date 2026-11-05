use sc_chat::{ChatPhase, ChatStatus};

const LABEL_MAX: u32 = 99;
#[cfg(any(windows, test))]
const GLYPH_MAX: u32 = 9;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Badge {
    pub count: u32,
    pub mention: bool,
}

impl Badge {
    pub fn from_status(status: &ChatStatus) -> Self {
        if !matches!(status.phase, ChatPhase::Ready | ChatPhase::Starting) {
            return Self::default();
        }
        Self {
            count: status.unread.max(status.mentions),
            mention: status.mentions > 0,
        }
    }

    pub fn label(self) -> Option<String> {
        if self.count == 0 {
            return None;
        }
        let count = if self.count > LABEL_MAX {
            format!("{LABEL_MAX}+")
        } else {
            self.count.to_string()
        };
        Some(if self.mention {
            format!("@{count}")
        } else {
            count
        })
    }

    pub fn title(self, base: &str) -> String {
        match self.label() {
            Some(label) => format!("({label}) {base}"),
            None => base.to_owned(),
        }
    }

    #[cfg(any(windows, test))]
    pub fn glyph(self) -> Option<String> {
        match self.count {
            0 => None,
            _ if self.mention => Some("@".to_owned()),
            count if count > GLYPH_MAX => Some(format!("{GLYPH_MAX}+")),
            count => Some(count.to_string()),
        }
    }
}

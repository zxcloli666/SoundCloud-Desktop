use super::glyph::Glyph;
use crate::app::tray_labels::TrayLabels;

pub const TIP_LENGTH: usize = 260;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Button {
    Previous,
    PlayPause,
    Next,
}

impl Button {
    pub const ALL: [Self; 3] = [Self::Previous, Self::PlayPause, Self::Next];

    pub fn from_id(id: u32) -> Option<Self> {
        Self::ALL.into_iter().find(|button| button.id() == id)
    }

    pub fn id(self) -> u32 {
        match self {
            Self::Previous => 1,
            Self::PlayPause => 2,
            Self::Next => 3,
        }
    }

    pub fn action(self) -> &'static str {
        match self {
            Self::Previous => "prev",
            Self::PlayPause => "play_pause",
            Self::Next => "next",
        }
    }

    pub fn glyph(self, playing: bool) -> Glyph {
        match self {
            Self::Previous => Glyph::Previous,
            Self::PlayPause if playing => Glyph::Pause,
            Self::PlayPause => Glyph::Play,
            Self::Next => Glyph::Next,
        }
    }

    pub fn tip(self, labels: &TrayLabels) -> [u16; TIP_LENGTH] {
        let label = match self {
            Self::Previous => &labels.prev,
            Self::PlayPause => &labels.play_pause,
            Self::Next => &labels.next,
        };
        let mut tip = [0; TIP_LENGTH];
        for (slot, unit) in tip
            .iter_mut()
            .zip(label.encode_utf16().take(TIP_LENGTH - 1))
        {
            *slot = unit;
        }
        tip
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_lead_back_to_their_buttons() {
        for button in Button::ALL {
            assert_eq!(Button::from_id(button.id()), Some(button));
        }
        assert_eq!(Button::from_id(0), None);
        assert_eq!(Button::from_id(4), None);
    }

    #[test]
    fn buttons_send_the_tray_actions() {
        assert_eq!(
            Button::ALL.map(Button::action),
            ["prev", "play_pause", "next"]
        );
    }

    #[test]
    fn the_middle_glyph_follows_the_player() {
        assert_eq!(Button::PlayPause.glyph(false), Glyph::Play);
        assert_eq!(Button::PlayPause.glyph(true), Glyph::Pause);
        assert_eq!(Button::Previous.glyph(true), Glyph::Previous);
        assert_eq!(Button::Next.glyph(true), Glyph::Next);
    }

    #[test]
    fn tips_are_terminated_labels() {
        let labels = TrayLabels {
            prev: "Назад".into(),
            next: "x".repeat(400),
            ..TrayLabels::default()
        };
        let tip = Button::Previous.tip(&labels);
        assert_eq!(String::from_utf16_lossy(&tip[..5]), "Назад");
        assert_eq!(tip[5], 0);
        assert_eq!(Button::Next.tip(&labels)[TIP_LENGTH - 1], 0);
        assert_eq!(Button::PlayPause.tip(&labels)[0], u16::from(b'P'));
    }
}

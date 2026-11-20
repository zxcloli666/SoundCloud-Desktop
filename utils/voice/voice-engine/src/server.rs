use crate::clip::Clip;

pub struct Ask<'a> {
    pub voice: &'a str,
    pub text: &'a str,
    pub kept: bool,
}

#[derive(Debug, PartialEq)]
pub struct Said {
    pub clip: Clip,
    pub revision: Option<String>,
}

pub trait Server: Send + Sync {
    fn say(&self, ask: &Ask, wanted: &dyn Fn() -> bool) -> Result<Said, String>;
}

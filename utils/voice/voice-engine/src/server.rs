use crate::clip::Clip;

pub struct Ask<'a> {
    pub voice: &'a str,
    pub text: &'a str,
    pub kept: bool,
}

pub trait Server: Send + Sync {
    fn say(&self, ask: &Ask, wanted: &dyn Fn() -> bool) -> Result<Clip, String>;
}

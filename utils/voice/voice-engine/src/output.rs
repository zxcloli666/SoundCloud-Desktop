use std::sync::mpsc::Receiver;

use crate::stream::Stream;

pub trait Output: Send {
    fn duck(&self, level: f32);
    fn reference(&self, on: bool);
    fn device(&self) -> Option<String>;
    fn speak(&self, stream: Stream) -> Result<Receiver<()>, String>;
    fn hush(&self);
}

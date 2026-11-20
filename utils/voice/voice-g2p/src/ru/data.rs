use fst::Map;
use std::path::Path;

pub struct Data {
    pub stress: Map<Vec<u8>>,
    pub yo: Map<Vec<u8>>,
    pub suffix: Map<Vec<u8>>,
}

impl Data {
    pub fn new(stress: Vec<u8>, yo: Vec<u8>, suffix: Vec<u8>) -> Result<Self, fst::Error> {
        Ok(Data {
            stress: Map::new(stress)?,
            yo: Map::new(yo)?,
            suffix: Map::new(suffix)?,
        })
    }

    #[cfg(feature = "bundled")]
    pub fn bundled() -> Self {
        Data::new(
            include_bytes!("../../data/ru-stress.fst").to_vec(),
            include_bytes!("../../data/ru-yo.fst").to_vec(),
            include_bytes!("../../data/ru-suffix.fst").to_vec(),
        )
        .expect("bundled ru data")
    }

    pub fn from_dir(dir: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Data::new(
            std::fs::read(dir.join("ru-stress.fst"))?,
            std::fs::read(dir.join("ru-yo.fst"))?,
            std::fs::read(dir.join("ru-suffix.fst"))?,
        )?)
    }
}

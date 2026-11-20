use fst::Map;

pub struct Lexicon {
    map: Map<Vec<u8>>,
    blob: Vec<u8>,
}

impl Lexicon {
    pub fn new(fst_bytes: Vec<u8>, blob: Vec<u8>) -> Result<Self, fst::Error> {
        Ok(Lexicon {
            map: Map::new(fst_bytes)?,
            blob,
        })
    }

    #[cfg(feature = "bundled")]
    pub fn bundled() -> Self {
        Lexicon::new(
            include_bytes!("../../data/en-us.fst").to_vec(),
            include_bytes!("../../data/en-us.ph").to_vec(),
        )
        .expect("bundled en data")
    }

    pub fn get(&self, word: &str) -> Option<&str> {
        let value = self.map.get(word.as_bytes())?;
        let offset = (value >> 16) as usize;
        let len = (value & 0xffff) as usize;
        std::str::from_utf8(&self.blob[offset..offset + len]).ok()
    }

    pub fn len(&self) -> usize {
        self.map.len()
    }

    pub fn is_empty(&self) -> bool {
        self.map.is_empty()
    }
}

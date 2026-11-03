use crate::entity::Entity;
use voice_nlu::{fold, Kind, Variant};

pub struct Keys {
    names: Vec<(String, f32)>,
    artist: Option<String>,
    own_artist_name: bool,
}

fn without_parens(name: &str) -> Option<String> {
    let open = name.find('(')?;
    let head = name[..open].trim();
    (!head.is_empty()).then(|| head.to_string())
}

impl Keys {
    pub fn new(e: &Entity) -> Keys {
        let mut names = vec![(fold(&e.name), 1.0)];
        if let Some(head) = without_parens(&e.name) {
            names.push((fold(&head), 1.0));
        }
        for a in &e.aliases {
            names.push((fold(a), 0.97));
        }
        names.retain(|(k, _)| !k.is_empty());
        Keys {
            names,
            artist: e.artist.as_deref().map(fold),
            own_artist_name: e.kind == Kind::Artist,
        }
    }

    pub fn sim(&self, v: &QueryKeys) -> f32 {
        let mut best = 0.0f32;
        for (name, w) in &self.names {
            best = best.max(voice_nlu::similarity(&v.text, name) * w);
            if let Some(artist) = &self.artist {
                best = best.max(combo(&v.text, artist, name) * w);
            }
        }
        if let (Some(qa), Some(qt)) = (&v.artist, &v.title) {
            let mut st = 0.0f32;
            for (name, w) in &self.names {
                st = st.max(voice_nlu::similarity(qt, name) * w);
            }
            let sa = match &self.artist {
                Some(artist) => voice_nlu::similarity(qa, artist),
                None => {
                    if self.own_artist_name {
                        0.0
                    } else {
                        0.2
                    }
                }
            };
            best = best.max(st * (0.35 + 0.65 * sa));
        }
        if v.kept {
            best *= 1.02;
        }
        best
    }
}

fn combo(q: &str, artist: &str, name: &str) -> f32 {
    let qc: Vec<char> = q.chars().collect();
    let total = qc.len();
    if total < 3 {
        return 0.0;
    }
    let near = voice_nlu::similarity(q, &format!("{artist}{name}")).max(voice_nlu::similarity(q, &format!("{name}{artist}")));
    if near < 0.5 {
        return 0.0;
    }
    let mut best = 0.0f32;
    for (first, second) in [(artist, name), (name, artist)] {
        let l1 = first.chars().count();
        let lo = l1.saturating_sub(3).max(1);
        let hi = (l1 + 3).min(total - 1);
        for p in lo..=hi {
            let left: String = qc[..p].iter().collect();
            let right: String = qc[p..].iter().collect();
            let s1 = voice_nlu::similarity(&left, first);
            let s2 = voice_nlu::similarity(&right, second);
            if s1 < 0.5 || s2 < 0.5 {
                continue;
            }
            let (w1, w2) = (l1 as f32, second.chars().count() as f32);
            best = best.max((s1 * w1 + s2 * w2) / (w1 + w2));
        }
    }
    best
}

pub struct QueryKeys {
    pub text: String,
    pub artist: Option<String>,
    pub title: Option<String>,
    pub kept: bool,
}

impl QueryKeys {
    pub fn new(v: &Variant) -> QueryKeys {
        QueryKeys {
            text: fold(&v.text),
            artist: v.artist.as_deref().map(fold),
            title: v.title.as_deref().map(fold),
            kept: v.kept_fillers,
        }
    }
}

pub fn best_sim(keys: &Keys, queries: &[QueryKeys]) -> f32 {
    queries.iter().map(|q| keys.sim(q)).fold(0.0, f32::max)
}

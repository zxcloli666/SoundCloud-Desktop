use super::respell::Letter;

#[derive(Clone, Copy, Debug)]
struct Cons {
    c: char,
    soft: bool,
    long: bool,
}

#[derive(Clone, Copy, Debug)]
struct Vow {
    letter: char,
    stressed: bool,
    hard_before: bool,
    after_j: bool,
    word_end: bool,
}

#[derive(Clone, Copy, Debug)]
enum Seg {
    C(Cons),
    V(Vow),
    J,
}

fn consonant(letter: char) -> Option<char> {
    Some(match letter {
        'б' => 'b',
        'п' => 'p',
        'в' => 'v',
        'ф' => 'f',
        'г' => 'ɡ',
        'к' => 'k',
        'д' => 'd',
        'т' => 't',
        'з' => 'z',
        'с' => 's',
        'ж' => 'ʐ',
        'ш' => 'ʂ',
        'х' => 'x',
        'ц' => 'ʦ',
        'ч' => 'ʨ',
        'щ' => 'ɕ',
        'м' => 'm',
        'н' => 'n',
        'л' => 'l',
        'р' => 'r',
        _ => return None,
    })
}

fn is_vowel_letter(c: char) -> bool {
    "аеёиоуыэюя".contains(c)
}

fn always_hard(c: char) -> bool {
    matches!(c, 'ʐ' | 'ʂ' | 'ʦ')
}

fn always_soft(c: char) -> bool {
    matches!(c, 'ʨ' | 'ɕ')
}

fn voiced_of(c: char) -> Option<char> {
    Some(match c {
        'p' => 'b',
        'f' => 'v',
        'k' => 'ɡ',
        't' => 'd',
        'ʂ' => 'ʐ',
        's' => 'z',
        _ => return None,
    })
}

fn voiceless_of(c: char) -> Option<char> {
    Some(match c {
        'b' => 'p',
        'v' => 'f',
        'ɡ' => 'k',
        'd' => 't',
        'ʐ' => 'ʂ',
        'z' => 's',
        _ => return None,
    })
}

fn triggers_voicing(c: char) -> Option<bool> {
    match c {
        'b' | 'ɡ' | 'd' | 'ʐ' | 'z' => Some(true),
        'p' | 'f' | 'k' | 't' | 'ʂ' | 's' | 'x' | 'ʦ' | 'ʨ' | 'ɕ' => Some(false),
        _ => None,
    }
}

fn segments(letters: &[Letter]) -> Vec<Seg> {
    let mut segs = Vec::new();
    let n = letters.len();
    for i in 0..n {
        let l = letters[i];
        let prev = if i > 0 { Some(letters[i - 1]) } else { None };
        let next = letters.get(i + 1).map(|x| x.c);
        if let Some(c) = consonant(l.c) {
            let hard_forced = always_hard(c);
            let soft_next = matches!(next, Some('ь' | 'я' | 'ю' | 'е' | 'ё' | 'и'));
            let soft = always_soft(c) || (soft_next && !hard_forced);
            segs.push(Seg::C(Cons { c, soft, long: false }));
            continue;
        }
        match l.c {
            'й' => segs.push(Seg::J),
            'ъ' | 'ь' | '-' => {}
            'а' | 'о' | 'у' | 'ы' | 'э' => segs.push(Seg::V(vowel(l, &segs, false))),
            'я' | 'ю' | 'е' | 'ё' | 'и' => {
                let prev_c = prev.map(|p| p.c);
                let after_vowel = prev_c.is_some_and(is_vowel_letter);
                let iotate = match l.c {
                    'и' => prev_c == Some('ь'),
                    _ => l.start || after_vowel || matches!(prev_c, Some('ъ' | 'ь')),
                };
                if iotate {
                    segs.push(Seg::J);
                }
                let mut v = vowel(l, &segs, iotate);
                if l.c == 'и' && l.start {
                    if let Some(Seg::C(c)) = segs.last() {
                        if !c.soft && !always_soft(c.c) {
                            v.letter = 'ы';
                        }
                    }
                }
                segs.push(Seg::V(v));
            }
            _ => {}
        }
    }
    segs
}

fn vowel(l: Letter, segs: &[Seg], iotated: bool) -> Vow {
    let (hard_before, after_j) = match segs.last() {
        Some(Seg::C(c)) if !iotated => (always_hard(c.c), false),
        Some(Seg::J) => (false, true),
        _ => (false, false),
    };
    Vow {
        letter: l.c,
        stressed: l.stressed,
        hard_before,
        after_j,
        word_end: l.end,
    }
}

fn assimilate(segs: &mut Vec<Seg>) {
    if let Some(Seg::C(last)) = segs.last_mut() {
        if let Some(v) = voiceless_of(last.c) {
            last.c = v;
        }
    }
    let n = segs.len();
    for i in (0..n.saturating_sub(1)).rev() {
        let (Seg::C(cur), Seg::C(next)) = (segs[i], segs[i + 1]) else {
            continue;
        };
        let mut cur = cur;
        if let Some(voiced) = triggers_voicing(next.c) {
            if voiced {
                if let Some(v) = voiced_of(cur.c) {
                    cur.c = v;
                }
            } else if let Some(v) = voiceless_of(cur.c) {
                cur.c = v;
            }
        }
        if cur.c == next.c && next.soft && !always_soft(cur.c) {
            cur.soft = true;
        }
        let softens = match cur.c {
            's' | 'z' | 't' | 'd' => next.soft && matches!(next.c, 'n' | 'l'),
            'n' => next.soft && matches!(next.c, 't' | 'd' | 's' | 'z' | 'l' | 'n') || matches!(next.c, 'ʨ' | 'ɕ'),
            'l' => matches!(next.c, 'ʨ' | 'ɕ'),
            _ => false,
        };
        if softens {
            cur.soft = true;
        }
        segs[i] = Seg::C(cur);
    }
}

fn merge_long(segs: Vec<Seg>) -> Vec<Seg> {
    let mut out: Vec<Seg> = Vec::new();
    for seg in segs {
        if let (Seg::C(cur), Some(Seg::C(prev))) = (seg, out.last_mut()) {
            if cur.c == prev.c && cur.soft == prev.soft {
                prev.long = true;
                continue;
            }
        }
        out.push(seg);
    }
    out
}

fn reduce(segs: &[Seg]) -> Vec<(Vow, char)> {
    let vowel_ids: Vec<usize> = segs
        .iter()
        .enumerate()
        .filter(|(_, s)| matches!(s, Seg::V(_)))
        .map(|(i, _)| i)
        .collect();
    let stressed = vowel_ids
        .iter()
        .position(|i| matches!(segs[*i], Seg::V(v) if v.stressed))
        .unwrap_or(0);
    let mut out = Vec::new();
    for (rank, id) in vowel_ids.iter().enumerate() {
        let Seg::V(mut v) = segs[*id] else { continue };
        let prev_cons = if *id > 0 { Some(segs[*id - 1]) } else { None };
        let after_ch = matches!(prev_cons, Some(Seg::C(c)) if always_soft(c.c));
        if rank == stressed {
            v.stressed = true;
        }
        let distance = stressed as i64 - rank as i64;
        let pretonic = distance > 0;
        let first_pretonic = distance == 1;
        let sound = if v.stressed || rank == stressed {
            match v.letter {
                'а' | 'я' => 'a',
                'о' | 'ё' => 'o',
                'у' | 'ю' => 'u',
                'ы' => 'ɨ',
                'э' | 'е' => 'ɛ',
                'и' if v.hard_before => 'ɨ',
                _ => 'i',
            }
        } else {
            match v.letter {
                'а' | 'о' if after_ch => {
                    if pretonic { 'ɪ' } else { 'ə' }
                }
                'а' | 'о' => {
                    if first_pretonic || (pretonic && *id == 0) { 'ɐ' } else { 'ə' }
                }
                'я' => {
                    if pretonic || !v.word_end { 'ɪ' } else { 'ə' }
                }
                'е' | 'э' if v.hard_before => {
                    if pretonic { 'ɨ' } else { 'ə' }
                }
                'е' if v.after_j && !pretonic => 'ə',
                'е' | 'э' => 'ɪ',
                'и' if v.hard_before => 'ɨ',
                'и' => 'ɪ',
                'у' | 'ю' => 'u',
                'ы' => 'ɨ',
                'ё' => 'o',
                _ => 'ə',
            }
        };
        out.push((v, sound));
    }
    out
}

fn push_cons(out: &mut String, c: Cons) {
    out.push(c.c);
    if c.soft && !always_soft(c.c) {
        out.push('ʲ');
    }
    if c.long || c.c == 'ɕ' {
        out.push('ː');
    }
}

pub fn unit_ipa(letters: &[Letter]) -> String {
    let mut segs = segments(letters);
    if !segs.iter().any(|s| matches!(s, Seg::V(_))) {
        let mut out = String::new();
        for s in segs {
            if let Seg::C(c) = s {
                push_cons(&mut out, c);
            }
        }
        return out;
    }
    assimilate(&mut segs);
    let segs = merge_long(segs);
    let sounds = reduce(&segs);
    let mut out = String::new();
    let mut k = 0;
    for seg in &segs {
        match seg {
            Seg::C(c) => push_cons(&mut out, *c),
            Seg::J => out.push('j'),
            Seg::V(_) => {
                let (v, sound) = sounds[k];
                k += 1;
                if v.stressed {
                    out.push('ˈ');
                }
                out.push(sound);
            }
        }
    }
    out
}

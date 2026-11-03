use voice_nlu::{fold, similarity};

const SAME: &[(&str, &str)] = &[
    ("уикенд", "The Weeknd"),
    ("зе уикенд", "The Weeknd"),
    ("билли айлиш", "Billie Eilish"),
    ("имеджин драгонс", "Imagine Dragons"),
    ("имаджин драгонс", "Imagine Dragons"),
    ("тейлор свифт", "Taylor Swift"),
    ("дрейк", "Drake"),
    ("дрэйк", "Drake"),
    ("эминем", "Eminem"),
    ("рианна", "Rihanna"),
    ("эд ширан", "Ed Sheeran"),
    ("дуа липа", "Dua Lipa"),
    ("колдплей", "Coldplay"),
    ("линкин парк", "Linkin Park"),
    ("рамштайн", "Rammstein"),
    ("нирвана", "Nirvana"),
    ("квин", "Queen"),
    ("пост малон", "Post Malone"),
    ("ариана гранде", "Ariana Grande"),
    ("лана дель рей", "Lana Del Rey"),
    ("бруно марс", "Bruno Mars"),
    ("трэвис скотт", "Travis Scott"),
    ("кендрик ламар", "Kendrick Lamar"),
    ("канье вест", "Kanye West"),
    ("джастин бибер", "Justin Bieber"),
    ("литл биг", "Little Big"),
    ("нойз мс", "Noize MC"),
    ("оксимирон", "Oxxxymiron"),
    ("бэд гай", "bad guy"),
    ("шейп оф ю", "Shape of You"),
    ("левитейтинг", "Levitating"),
    ("йеллоу", "Yellow"),
    ("сансара", "Sansara"),
    ("блайндинг лайтс", "Blinding Lights"),
    ("старбой", "Starboy"),
    ("севен рингс", "7 rings"),
    ("фифти сент", "50 Cent"),
    ("блинк сто восемьдесят два", "Blink-182"),
    ("два пак", "2Pac"),
    ("мияги", "Miyagi"),
    ("доджа кэт", "Doja Cat"),
    ("джа халиб", "Jah Khalib"),
    ("шейк ит оф", "Shake It Off"),
    ("ин зе энд", "In the End"),
    ("смелс лайк тин спирит", "Smells Like Teen Spirit"),
    ("богемиан рапсоди", "Bohemian Rhapsody"),
    ("саммертайм сэднесс", "Summertime Sadness"),
    ("аптаун фанк", "Uptown Funk"),
    ("ван дэнс", "One Dance"),
    ("хотлайн блинг", "Hotline Bling"),
    ("энтихиро", "Anti-Hero"),
    ("кант фил май фейс", "Can't Feel My Face"),
    ("демонс", "Demons"),
    ("радиоактив", "Radioactive"),
    ("амбрелла", "Umbrella"),
    ("перфект", "Perfect"),
    ("зиверт", "Zivert"),
    ("манескин", "Måneskin"),
    ("мумий тролль", "Mumiy Troll"),
    ("скриптонит", "Scriptonite"),
    ("моргенштерн", "Morgenshtern"),
    ("баста", "Basta"),
    ("земфира", "Zemfira"),
    ("монеточка", "Monetochka"),
    ("кровосток", "Krovostok"),
];

const DECOYS: &[(&str, &str)] = &[
    ("мот", "Mute"),
    ("баста", "Bastard"),
    ("скриптонит", "Scriptonid Tribute"),
    ("пост малон", "Post Malone Karaoke"),
    ("эд ширан", "Ed Sheeran Cover"),
    ("джастин бибер", "Justin Timberlake"),
];

const DIFFERENT: &[(&str, &str)] = &[
    ("уикенд", "Billie Eilish"),
    ("билли айлиш", "Imagine Dragons"),
    ("дрейк", "Eminem"),
    ("рианна", "Ariana Grande"),
    ("колдплей", "Linkin Park"),
    ("нирвана", "Rammstein"),
    ("квин", "Dua Lipa"),
    ("кино", "Queen"),
    ("звери", "Bruno Mars"),
    ("сплин", "Spotify"),
    ("тише", "Taylor Swift"),
    ("ленинград", "Nirvana"),
    ("тейлор свифт", "Travis Scott"),
    ("кендрик ламар", "Kanye West"),
    ("джастин бибер", "Selena Gomez"),
    ("шейп оф ю", "Perfect"),
    ("бэд гай", "Lovely"),
    ("блайндинг лайтс", "Starboy"),
    ("демонс", "Thunder"),
    ("амбрелла", "Radioactive"),
];

fn sims(pairs: &[(&str, &str)]) -> Vec<(f32, String)> {
    pairs
        .iter()
        .map(|(a, b)| (similarity(&fold(a), &fold(b)), format!("{a} / {b}")))
        .collect()
}

#[test]
fn same_names_score_high_and_different_low() {
    let mut same = sims(SAME);
    let mut diff = sims(DIFFERENT);
    same.sort_by(|a, b| a.0.total_cmp(&b.0));
    diff.sort_by(|a, b| b.0.total_cmp(&a.0));
    let mean = |v: &[(f32, String)]| v.iter().map(|x| x.0).sum::<f32>() / v.len() as f32;
    println!("same: n={} mean={:.3} worst:", same.len(), mean(&same));
    for (s, p) in same.iter().take(8) {
        println!("  {s:.3} {p}");
    }
    println!(
        "different: n={} mean={:.3} highest:",
        diff.len(),
        mean(&diff)
    );
    for (s, p) in diff.iter().take(8) {
        println!("  {s:.3} {p}");
    }
    for (s, p) in sims(DECOYS) {
        println!("decoy {s:.3} {p}");
    }
    let above_80 = same.iter().filter(|x| x.0 >= 0.8).count();
    let below_70 = diff.iter().filter(|x| x.0 < 0.7).count();
    println!(
        "same >= 0.80: {above_80}/{}  different < 0.70: {below_70}/{}",
        same.len(),
        diff.len()
    );
    assert!(above_80 * 100 >= same.len() * 85);
    assert!(below_70 * 100 >= diff.len() * 90);
}

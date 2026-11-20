use voice_g2p::ru::Russian;

fn main() {
    let ru = Russian::bundled();
    let path = std::env::args().nth(1).unwrap();
    for line in std::fs::read_to_string(path).unwrap().lines().skip(1) {
        let text = line.split('\t').nth(2).unwrap();
        println!("{}", ru.speak(text).ipa);
    }
}

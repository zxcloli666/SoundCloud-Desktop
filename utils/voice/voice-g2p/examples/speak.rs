use voice_g2p::ru::Russian;

fn main() {
    let ru = Russian::bundled();
    for text in std::env::args().skip(1) {
        let s = ru.speak(&text);
        println!("{}\n{}\n{}\n", s.text, s.chars, s.ipa);
    }
}

const LAB_IDENTIFIER: &str = "com.soundcloud.desktop.lab";

fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("linux") {
        println!("cargo:rustc-link-arg-bins=-Wl,--exclude-libs,ALL");
    }
    if std::env::var_os("CARGO_FEATURE_CHAT_LAB").is_some() {
        lab_identifier();
    }
    tauri_build::build()
}

fn lab_identifier() {
    let mut config = match std::env::var("TAURI_CONFIG") {
        Ok(raw) => serde_json::from_str(&raw).expect("TAURI_CONFIG must be JSON"),
        Err(_) => serde_json::json!({}),
    };
    config["identifier"] = LAB_IDENTIFIER.into();
    let merged = config.to_string();
    unsafe { std::env::set_var("TAURI_CONFIG", &merged) };
    println!("cargo:rustc-env=TAURI_CONFIG={merged}");
}

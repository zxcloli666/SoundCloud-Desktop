use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FlatpakScope {
    User,
    System,
}

#[cfg(target_os = "linux")]
pub fn detect_scope() -> Option<FlatpakScope> {
    let info = std::fs::read_to_string("/.flatpak-info").ok()?;
    scope_from_info(&info)
}

#[cfg(not(target_os = "linux"))]
pub fn detect_scope() -> Option<FlatpakScope> {
    None
}

#[cfg_attr(not(any(target_os = "linux", test)), allow(dead_code))]
fn scope_from_info(info: &str) -> Option<FlatpakScope> {
    let mut in_instance = false;
    for line in info.lines().map(str::trim) {
        if line.starts_with('[') {
            in_instance = line == "[Instance]";
            continue;
        }
        if !in_instance {
            continue;
        }
        if let Some(path) = line.strip_prefix("app-path=") {
            return Some(if path.contains("/.local/share/flatpak/") {
                FlatpakScope::User
            } else {
                FlatpakScope::System
            });
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_scope_from_the_app_path() {
        let user = "[Application]\nname=io.github.x\n\n[Instance]\napp-path=/home/me/.local/share/flatpak/app/io.github.x/x86_64/stable/abc/files\n";
        let system = "[Instance]\ninstance-id=1\napp-path=/var/lib/flatpak/app/io.github.x/x86_64/stable/abc/files\n";
        assert_eq!(scope_from_info(user), Some(FlatpakScope::User));
        assert_eq!(scope_from_info(system), Some(FlatpakScope::System));
    }

    #[test]
    fn missing_instance_path_has_no_scope() {
        assert_eq!(scope_from_info("[Application]\napp-path=/x\n"), None);
        assert_eq!(scope_from_info(""), None);
    }
}

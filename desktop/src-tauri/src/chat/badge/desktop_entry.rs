use std::path::Path;

pub fn app_uri(flatpak_id: Option<&str>, launched_from: Option<&str>, package: &str) -> String {
    format!(
        "application://{}",
        desktop_id(flatpak_id, launched_from, package)
    )
}

fn desktop_id(flatpak_id: Option<&str>, launched_from: Option<&str>, package: &str) -> String {
    if let Some(id) = flatpak_id.map(str::trim).filter(|id| !id.is_empty()) {
        return format!("{id}.desktop");
    }
    launched_from
        .and_then(|path| Path::new(path).file_name())
        .and_then(|name| name.to_str())
        .filter(|name| name.ends_with(".desktop"))
        .map(str::to_owned)
        .unwrap_or_else(|| format!("{package}.desktop"))
}

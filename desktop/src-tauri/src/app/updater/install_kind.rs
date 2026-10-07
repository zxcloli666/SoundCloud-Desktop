use std::path::Path;

use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum InstallKind {
    Nsis,
    Msi,
    Portable,
    MacApp,
    AppImage,
    Deb,
    Rpm,
    Aur,
    Flatpak,
    Source,
}

impl InstallKind {
    pub fn self_updatable(self) -> bool {
        matches!(self, Self::Nsis | Self::Msi | Self::MacApp | Self::AppImage)
    }
}

pub fn detect() -> InstallKind {
    match std::env::current_exe() {
        Ok(exe) => detect_for(&exe),
        Err(_) => InstallKind::Source,
    }
}

#[cfg(windows)]
fn detect_for(exe: &Path) -> InstallKind {
    let program_files: Vec<String> = ["ProgramFiles", "ProgramW6432", "ProgramFiles(x86)"]
        .iter()
        .filter_map(|name| std::env::var(name).ok())
        .collect();
    let has_uninstaller = exe
        .parent()
        .is_some_and(|dir| dir.join("uninstall.exe").is_file());
    classify_windows(exe, has_uninstaller, &program_files)
}

#[cfg(target_os = "macos")]
fn detect_for(exe: &Path) -> InstallKind {
    classify_macos(exe)
}

#[cfg(target_os = "linux")]
fn detect_for(exe: &Path) -> InstallKind {
    let probe = LinuxProbe {
        flatpak: std::env::var_os("FLATPAK_ID").is_some() || Path::new("/.flatpak-info").exists(),
        appimage: std::env::var_os("APPIMAGE").is_some(),
        dpkg_entry: Path::new("/var/lib/dpkg/info/soundcloud-desktop.list").exists(),
        pacman: Path::new("/var/lib/pacman").is_dir(),
        rpm: Path::new("/var/lib/rpm").is_dir(),
    };
    classify_linux(exe, &probe)
}

#[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
fn detect_for(_exe: &Path) -> InstallKind {
    InstallKind::Source
}

#[cfg_attr(not(any(windows, test)), allow(dead_code))]
fn classify_windows(exe: &Path, has_uninstaller: bool, program_files: &[String]) -> InstallKind {
    if has_uninstaller {
        return InstallKind::Nsis;
    }
    let exe = exe.to_string_lossy().to_lowercase();
    let installed = program_files.iter().any(|root| {
        let root = root.trim_end_matches(['\\', '/']).to_lowercase();
        !root.is_empty() && exe.starts_with(&format!("{root}\\"))
    });
    if installed {
        InstallKind::Msi
    } else {
        InstallKind::Portable
    }
}

#[cfg_attr(not(any(target_os = "macos", test)), allow(dead_code))]
fn classify_macos(exe: &Path) -> InstallKind {
    let in_bundle = exe
        .ancestors()
        .filter_map(|dir| dir.extension())
        .any(|ext| ext == "app");
    if in_bundle {
        InstallKind::MacApp
    } else {
        InstallKind::Source
    }
}

#[cfg_attr(not(any(target_os = "linux", test)), allow(dead_code))]
struct LinuxProbe {
    flatpak: bool,
    appimage: bool,
    dpkg_entry: bool,
    pacman: bool,
    rpm: bool,
}

#[cfg_attr(not(any(target_os = "linux", test)), allow(dead_code))]
fn classify_linux(exe: &Path, probe: &LinuxProbe) -> InstallKind {
    if probe.flatpak {
        return InstallKind::Flatpak;
    }
    if probe.appimage {
        return InstallKind::AppImage;
    }
    if !exe.starts_with("/usr") && !exe.starts_with("/opt") {
        return InstallKind::Source;
    }
    if probe.dpkg_entry {
        InstallKind::Deb
    } else if probe.pacman {
        InstallKind::Aur
    } else if probe.rpm {
        InstallKind::Rpm
    } else {
        InstallKind::Source
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn linux_probe() -> LinuxProbe {
        LinuxProbe {
            flatpak: false,
            appimage: false,
            dpkg_entry: false,
            pacman: false,
            rpm: false,
        }
    }

    #[test]
    fn windows_installer_layouts() {
        let roots = vec!["C:\\Program Files".to_string()];
        let nsis =
            Path::new("C:\\Users\\me\\AppData\\Local\\soundcloud-desktop\\soundcloud-desktop.exe");
        let msi = Path::new("C:\\Program Files\\soundcloud-desktop\\soundcloud-desktop.exe");
        let portable = Path::new("D:\\apps\\soundcloud-desktop-portable.exe");
        assert_eq!(classify_windows(nsis, true, &roots), InstallKind::Nsis);
        assert_eq!(classify_windows(msi, false, &roots), InstallKind::Msi);
        assert_eq!(
            classify_windows(portable, false, &roots),
            InstallKind::Portable
        );
        assert_eq!(classify_windows(msi, false, &[]), InstallKind::Portable);
    }

    #[test]
    fn macos_bundle_detection() {
        let bundled =
            Path::new("/Applications/soundcloud-desktop.app/Contents/MacOS/soundcloud-desktop");
        let loose = Path::new("/Users/me/src/target/release/soundcloud-desktop");
        assert_eq!(classify_macos(bundled), InstallKind::MacApp);
        assert_eq!(classify_macos(loose), InstallKind::Source);
    }

    #[test]
    fn linux_channels() {
        let system = Path::new("/usr/bin/soundcloud-desktop");
        let home = Path::new(
            "/home/pi/SoundCloud-Desktop/desktop/src-tauri/target/release/soundcloud-desktop",
        );

        let flatpak = LinuxProbe {
            flatpak: true,
            ..linux_probe()
        };
        assert_eq!(
            classify_linux(Path::new("/app/bin/soundcloud-desktop"), &flatpak),
            InstallKind::Flatpak
        );

        let appimage = LinuxProbe {
            appimage: true,
            ..linux_probe()
        };
        assert_eq!(
            classify_linux(
                Path::new("/tmp/.mount_x/usr/bin/soundcloud-desktop"),
                &appimage
            ),
            InstallKind::AppImage
        );

        let deb = LinuxProbe {
            dpkg_entry: true,
            rpm: true,
            ..linux_probe()
        };
        assert_eq!(classify_linux(system, &deb), InstallKind::Deb);

        let aur = LinuxProbe {
            pacman: true,
            ..linux_probe()
        };
        assert_eq!(classify_linux(system, &aur), InstallKind::Aur);

        let rpm = LinuxProbe {
            rpm: true,
            ..linux_probe()
        };
        assert_eq!(classify_linux(system, &rpm), InstallKind::Rpm);

        assert_eq!(classify_linux(home, &deb), InstallKind::Source);
        assert_eq!(classify_linux(system, &linux_probe()), InstallKind::Source);
    }

    #[test]
    fn only_bundles_the_updater_can_replace_self_update() {
        assert!(InstallKind::Nsis.self_updatable());
        assert!(InstallKind::AppImage.self_updatable());
        assert!(!InstallKind::Portable.self_updatable());
        assert!(!InstallKind::Deb.self_updatable());
        assert!(!InstallKind::Flatpak.self_updatable());
    }
}

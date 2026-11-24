use std::ffi::{OsString, c_void};
use std::os::windows::ffi::{OsStrExt, OsStringExt};
use std::path::{Path, PathBuf};

use windows::Win32::System::Com::{
    CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx, CoTaskMemFree,
    CoUninitialize, IPersistFile, STGM_READWRITE,
};
use windows::Win32::UI::Shell::{
    FOLDERID_Desktop, FOLDERID_Programs, FOLDERID_UserPinned, IShellLinkW, KF_FLAG_DEFAULT,
    SHCNE_UPDATEITEM, SHCNF_PATHW, SHChangeNotify, SHGetKnownFolderPath, ShellLink,
};
use windows::core::{GUID, HSTRING, Interface, PCWSTR};

const PATH_LEN: usize = 1024;

pub fn repoint_all(exe: &Path, icon: &Path) -> Result<(), String> {
    in_com(|| {
        let failed: Vec<String> = folders()
            .iter()
            .flat_map(|folder| links(folder))
            .filter_map(|link| {
                let error = repoint(&link, exe, icon).err()?;
                Some(format!("{}: {error}", link.display()))
            })
            .collect();
        match failed.is_empty() {
            true => Ok(()),
            false => Err(failed.join("; ")),
        }
    })
}

fn in_com<T>(work: impl FnOnce() -> T) -> T {
    let entered = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }.is_ok();
    let done = work();
    if entered {
        unsafe { CoUninitialize() };
    }
    done
}

fn folders() -> Vec<PathBuf> {
    let programs = known_folder(&FOLDERID_Programs);
    let nested = programs.iter().flat_map(|dir| subfolders(dir));
    known_folder(&FOLDERID_Desktop)
        .into_iter()
        .chain(known_folder(&FOLDERID_UserPinned).map(|dir| dir.join("TaskBar")))
        .chain(nested)
        .chain(programs.clone())
        .collect()
}

fn known_folder(id: &GUID) -> Option<PathBuf> {
    unsafe {
        let path = SHGetKnownFolderPath(id, KF_FLAG_DEFAULT, None).ok()?;
        let text = OsString::from_wide(path.as_wide());
        CoTaskMemFree(Some(path.as_ptr() as *const c_void));
        Some(PathBuf::from(text))
    }
}

fn entries(dir: &Path) -> Vec<PathBuf> {
    std::fs::read_dir(dir)
        .map(|entries| entries.flatten().map(|entry| entry.path()).collect())
        .unwrap_or_default()
}

fn subfolders(dir: &Path) -> Vec<PathBuf> {
    let mut found = entries(dir);
    found.retain(|path| path.is_dir());
    found
}

fn links(dir: &Path) -> Vec<PathBuf> {
    let mut found = entries(dir);
    found.retain(|path| {
        path.extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("lnk"))
    });
    found
}

fn repoint(link: &Path, exe: &Path, icon: &Path) -> windows::core::Result<()> {
    let shell: IShellLinkW = unsafe { CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER) }?;
    let file: IPersistFile = shell.cast()?;
    let path = HSTRING::from(link);
    unsafe { file.Load(&path, STGM_READWRITE) }?;
    if !same(&target(&shell)?, exe) || same(&icon_of(&shell)?, icon) {
        return Ok(());
    }
    unsafe {
        shell.SetIconLocation(&HSTRING::from(icon), 0)?;
        file.Save(&path, true)?;
        notify(link);
    }
    Ok(())
}

fn target(shell: &IShellLinkW) -> windows::core::Result<PathBuf> {
    let mut path = [0u16; PATH_LEN];
    unsafe { shell.GetPath(&mut path, std::ptr::null_mut(), 0) }?;
    Ok(until_nul(&path))
}

fn icon_of(shell: &IShellLinkW) -> windows::core::Result<PathBuf> {
    let mut path = [0u16; PATH_LEN];
    let mut index = 0;
    unsafe { shell.GetIconLocation(&mut path, &mut index) }?;
    Ok(until_nul(&path))
}

fn until_nul(text: &[u16]) -> PathBuf {
    let end = text
        .iter()
        .position(|unit| *unit == 0)
        .unwrap_or(text.len());
    OsString::from_wide(&text[..end]).into()
}

fn same(left: &Path, right: &Path) -> bool {
    left.to_string_lossy().to_lowercase() == right.to_string_lossy().to_lowercase()
}

unsafe fn notify(link: &Path) {
    let path: Vec<u16> = link.as_os_str().encode_wide().chain([0]).collect();
    let path = PCWSTR(path.as_ptr());
    unsafe {
        SHChangeNotify(
            SHCNE_UPDATEITEM,
            SHCNF_PATHW,
            Some(path.as_ptr().cast()),
            None,
        )
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make(link: &Path, exe: &Path) {
        let shell: IShellLinkW =
            unsafe { CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER) }.unwrap();
        unsafe { shell.SetPath(&HSTRING::from(exe)) }.unwrap();
        let file: IPersistFile = shell.cast().unwrap();
        unsafe { file.Save(&HSTRING::from(link), true) }.unwrap();
    }

    fn icon_in(link: &Path) -> PathBuf {
        let shell: IShellLinkW =
            unsafe { CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER) }.unwrap();
        let file: IPersistFile = shell.cast().unwrap();
        unsafe { file.Load(&HSTRING::from(link), STGM_READWRITE) }.unwrap();
        icon_of(&shell).unwrap()
    }

    #[test]
    fn only_our_shortcut_gets_the_icon() {
        let dir = std::env::temp_dir().join(format!("scd-links-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let exe = std::env::current_exe().unwrap();
        let (ours, other) = (dir.join("ours.lnk"), dir.join("other.lnk"));
        let icon = dir.join("app-icon-1.ico");
        in_com(|| {
            make(&ours, &exe);
            make(&other, Path::new(r"C:\Windows\notepad.exe"));
            for link in links(&dir) {
                repoint(&link, &exe, &icon).unwrap();
            }
            assert!(same(&icon_in(&ours), &icon));
            assert!(!same(&icon_in(&other), &icon));

            repoint(&ours, &exe, &exe).unwrap();
            assert!(same(&icon_in(&ours), &exe));
        });
        std::fs::remove_dir_all(dir).unwrap();
    }
}

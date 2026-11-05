use std::fs;
use std::path::PathBuf;

use super::cache_copy;
use super::parse::{
    fehbg_image, gvariant_string, hyprpaper_image, largest_package_image, plasma_activity,
    plasma_image, slideshow_first, swww_image, system_data_dirs, uri_path, xfce_image_property,
};

const PLASMA: &str = "
[Containments][12]
activityId=
formfactor=2
lastScreen=0
plugin=org.kde.panel

[Containments][3]
activityId=f2c1
lastScreen=1
plugin=org.kde.plasma.folder
wallpaperplugin=org.kde.image

[Containments][3][Wallpaper][org.kde.image][General]
Image=file:///home/u/Pictures/second.png

[Containments][7]
activityId=f2c1
lastScreen=0
plugin=org.kde.plasma.folder
wallpaperplugin=org.kde.image

[Containments][7][Wallpaper][org.kde.image][General]
Image=file:///home/u/Pictures/main%20screen.jpg
SlidePaths=/usr/share/wallpapers/

[Containments][9]
activityId=b7d0
lastScreen=0
plugin=org.kde.plasma.folder
wallpaperplugin=org.kde.slideshow

[Containments][9][Wallpaper][org.kde.image][General]
Image=file:///home/u/Pictures/stale.jpg

[Containments][9][Wallpaper][org.kde.slideshow][General]
SlidePaths=/home/u/Pictures/
";

const PLASMA_UNTOUCHED: &str = "
[Containments][1]
activityId=f2c1
lastScreen=0
plugin=org.kde.plasma.folder
wallpaperplugin=org.kde.image
";

const XFCE_PROPERTIES: &str = "
/backdrop/screen0/monitor0/image-path
/backdrop/screen0/monitor0/last-image
/backdrop/screen0/monitorHDMI-1/workspace0/last-image
/backdrop/screen0/monitoreDP-1/workspace0/color-style
/backdrop/screen0/monitoreDP-1/workspace0/last-image
/backdrop/screen0/monitoreDP-1/workspace1/last-image
";

const GNOME_TIMED: &str = "<background>
  <starttime><year>2024</year><hour>8</hour></starttime>
  <static>
    <duration>43200.0</duration>
    <file>/usr/share/backgrounds/f40/default/f40-01-day.png</file>
  </static>
  <transition type=\"overlay\">
    <from>/usr/share/backgrounds/f40/default/f40-01-day.png</from>
    <to>/usr/share/backgrounds/f40/default/f40-01-night.png</to>
  </transition>
</background>";

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "scd-desktop-wallpaper-{name}-{}",
        std::process::id()
    ));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn uris_and_plain_paths_become_files() {
    #[cfg(unix)]
    assert_eq!(
        uri_path("file:///home/u/My%20Pictures/a.jpg\n"),
        Some(PathBuf::from("/home/u/My Pictures/a.jpg"))
    );
    assert_eq!(
        uri_path("/usr/share/a.png"),
        Some(PathBuf::from("/usr/share/a.png"))
    );
    assert_eq!(uri_path(""), None);
    assert_eq!(uri_path("color: 000000"), None);
}

#[test]
fn gsettings_strings_lose_their_quotes() {
    assert_eq!(
        gvariant_string("'file:///usr/share/backgrounds/gnome/blobs-l.svg'\n"),
        Some("file:///usr/share/backgrounds/gnome/blobs-l.svg")
    );
    assert_eq!(
        gvariant_string("\"/home/u/it's.png\""),
        Some("/home/u/it's.png")
    );
    assert_eq!(gvariant_string("''"), Some(""));
    assert_eq!(gvariant_string("No such key"), None);
}

#[test]
fn daemon_queries_give_the_first_image() {
    assert_eq!(
        swww_image(": eDP-1: 1920x1080, scale: 1, currently displaying: image: /home/u/w.png\n"),
        Some("/home/u/w.png")
    );
    assert_eq!(
        swww_image("HDMI-A-1: 2560x1440, scale: 1, currently displaying: color: 000000"),
        None
    );
    assert_eq!(
        hyprpaper_image("eDP-1 = /home/u/w.jpg\nDP-2 = /home/u/v.jpg\n"),
        Some("/home/u/w.jpg")
    );
    assert_eq!(hyprpaper_image("invalid hyprpaper request"), None);
}

#[test]
fn fehbg_gives_the_first_quoted_path() {
    let script = "#!/bin/sh\nfeh --no-fehbg --bg-fill '/home/u/a b.jpg' '/home/u/c.jpg' \n";
    assert_eq!(fehbg_image(script), Some("/home/u/a b.jpg"));
    assert_eq!(fehbg_image("#!/bin/sh\n"), None);
}

#[test]
fn xfce_prefers_a_connected_monitor() {
    let monitors = "Monitors: 1\n 0: +*eDP-1 1920/344x1080/193+0+0  eDP-1\n";
    assert_eq!(
        xfce_image_property(XFCE_PROPERTIES, monitors),
        Some("/backdrop/screen0/monitoreDP-1/workspace0/last-image")
    );
    assert_eq!(
        xfce_image_property(XFCE_PROPERTIES, ""),
        Some("/backdrop/screen0/monitorHDMI-1/workspace0/last-image")
    );
    assert_eq!(
        xfce_image_property("/desktop-icons/style\n", monitors),
        None
    );
}

#[test]
fn plasma_follows_the_current_activity_and_screen() {
    assert_eq!(
        plasma_image(PLASMA, None),
        Some("file:///home/u/Pictures/main%20screen.jpg")
    );
    assert_eq!(
        plasma_image(PLASMA, plasma_activity("[main]\ncurrentActivity=f2c1\n")),
        Some("file:///home/u/Pictures/main%20screen.jpg")
    );
    assert_eq!(plasma_image(PLASMA, Some("b7d0")), None);
    assert_eq!(
        plasma_image(PLASMA_UNTOUCHED, None),
        Some("/usr/share/wallpapers/Next")
    );
    assert_eq!(
        plasma_image("[Containments][1]\nlastScreen=0\n", None),
        None
    );
}

#[test]
fn gnome_slideshow_starts_from_its_first_file() {
    assert_eq!(
        slideshow_first(GNOME_TIMED),
        Some(PathBuf::from(
            "/usr/share/backgrounds/f40/default/f40-01-day.png"
        ))
    );
    assert_eq!(slideshow_first("<background></background>"), None);
}

#[test]
fn plasma_package_uses_the_largest_image() {
    let names = ["1920x1080.png", "5120x2880.png", "720x1440.png"].map(String::from);
    assert_eq!(largest_package_image(&names), Some("5120x2880.png"));
    assert_eq!(largest_package_image(&[]), None);
}

#[test]
fn appimage_data_dirs_give_way_to_the_system() {
    assert_eq!(
        system_data_dirs(
            "/tmp/.mount_scdAb12/usr/share:/usr/share:/usr/share/gnome:/var/lib/flatpak/exports/share",
            "/tmp/.mount_scdAb12"
        ),
        "/usr/share:/usr/share/gnome:/var/lib/flatpak/exports/share"
    );
    assert_eq!(
        system_data_dirs("/tmp/.mount_scdAb12//usr/share:", "/tmp/.mount_scdAb12/"),
        "/usr/local/share:/usr/share"
    );
    assert_eq!(
        system_data_dirs("/tmp/.mount_scdAb12x/usr/share", "/tmp/.mount_scdAb12"),
        "/tmp/.mount_scdAb12x/usr/share"
    );
}

#[test]
fn cache_copy_keeps_one_copy_per_wallpaper() {
    let root = temp_dir("copy");
    let cache = root.join("wallpapers");
    let source = root.join("Wall.PNG");
    fs::write(&source, b"first").unwrap();
    fs::create_dir_all(&cache).unwrap();
    fs::write(cache.join("wallpaper_1.jpg"), b"own").unwrap();

    let first = cache_copy(&source, &cache).unwrap();
    assert!(first.starts_with("desktop_") && first.ends_with(".png"));
    assert_eq!(cache_copy(&source, &cache).as_deref(), Some(first.as_str()));

    fs::write(&source, b"second image").unwrap();
    let second = cache_copy(&source, &cache).unwrap();
    assert_ne!(first, second);
    assert_eq!(fs::read(cache.join(&second)).unwrap(), b"second image");
    assert!(!cache.join(&first).exists());
    assert!(cache.join("wallpaper_1.jpg").exists());

    let movie = root.join("aerial.mov");
    fs::write(&movie, b"frames").unwrap();
    assert_eq!(cache_copy(&movie, &cache), None);
    assert_eq!(cache_copy(&root.join("missing.jpg"), &cache), None);
    assert_eq!(cache_copy(&root, &cache), None);
    fs::remove_dir_all(&root).unwrap();
}

use std::sync::atomic::AtomicBool;

use super::model::ExtList;
use super::run::build_client;
use super::source::{Source, detect};
use super::spotify;
use super::ym::Ym;
use super::youtube;

fn show(name: &str, list: &ExtList) {
    println!(
        "{name}: \"{}\" {} tracks, partial {}",
        list.title,
        list.tracks.len(),
        list.partial
    );
    for track in list.tracks.iter().take(3) {
        println!("  {} | {}", track.artist, track.title);
    }
}

#[tokio::test]
#[ignore]
async fn spotify_playlist_by_link() {
    let client = build_client().unwrap();
    let Some(Source::Spotify(source)) =
        detect("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M")
    else {
        panic!("not spotify");
    };
    let list = spotify::fetch(&client, &source).await.unwrap();
    show("spotify playlist", &list);
    assert!(!list.tracks.is_empty());
}

#[tokio::test]
#[ignore]
async fn spotify_album_and_track_by_link() {
    let client = build_client().unwrap();
    for link in [
        "https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy",
        "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
    ] {
        let Some(Source::Spotify(source)) = detect(link) else {
            panic!("not spotify")
        };
        let list = spotify::fetch(&client, &source).await.unwrap();
        show(link, &list);
        assert!(!list.tracks.is_empty());
    }
}

#[tokio::test]
#[ignore]
async fn youtube_playlist_and_video_by_link() {
    let client = build_client().unwrap();
    for link in [
        "https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ] {
        let Some(Source::YouTube(source)) = detect(link) else {
            panic!("not youtube")
        };
        let list = youtube::fetch(&client, &source, &|_, _| {}).await.unwrap();
        show(link, &list);
        assert!(!list.tracks.is_empty());
    }
}

#[tokio::test]
#[ignore]
async fn yandex_album_and_track_by_link() {
    let client = build_client().unwrap();
    let cancel = AtomicBool::new(false);
    for link in [
        "https://music.yandex.ru/album/3389008",
        "https://music.yandex.ru/album/3389008/track/1710808",
    ] {
        let Some(Source::Yandex(source)) = detect(link) else {
            panic!("not yandex")
        };
        let ym = Ym {
            client: &client,
            token: None,
            cancel: &cancel,
        };
        let list = ym.fetch(&source, &|_, _| {}).await.unwrap();
        show(link, &list);
        assert!(!list.tracks.is_empty());
    }
}

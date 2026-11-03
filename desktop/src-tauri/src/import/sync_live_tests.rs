use std::collections::HashSet;
use std::sync::atomic::AtomicBool;

use super::model::ExtList;
use super::request::Request;
use super::run::{build_client, read};
use super::sync_plan::{fresh, key, syncable};

async fn load(link: &str) -> ExtList {
    let client = build_client().unwrap();
    let cancel = AtomicBool::new(false);
    let request = Request::Link {
        url: link.to_string(),
        token: None,
    };
    assert!(syncable(&request));
    read(&client, request, &cancel, &|_, _| {}).await.unwrap()
}

async fn twice(link: &str) {
    let first = load(link).await;
    let keys: Vec<String> = first.tracks.iter().map(key).collect();
    println!("{link}: \"{}\" read 1: {} tracks", first.title, keys.len());
    assert!(keys.len() > 3);

    let second = load(link).await;
    let all: HashSet<String> = keys.iter().cloned().collect();
    let stable = fresh(&second.tracks, &all);
    println!("read 2 against all seen: {} new", stable.len());
    assert!(stable.is_empty());

    let before: HashSet<String> = keys[..keys.len() - 3].iter().cloned().collect();
    let appeared = fresh(&second.tracks, &before);
    println!("read 2 against state minus last 3: {} new", appeared.len());
    for track in &appeared {
        println!("  + {}", track.label());
    }
    assert!((1..=3).contains(&appeared.len()));
}

#[tokio::test]
#[ignore]
async fn spotify_playlist_new_since_last() {
    twice("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M").await;
}

#[tokio::test]
#[ignore]
async fn youtube_playlist_new_since_last() {
    twice("https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI").await;
}

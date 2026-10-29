use std::sync::{Mutex, OnceLock};
use std::time::Instant;

use serde::Serialize;

use super::attempt::Attempt;
use crate::network::edge::Tier;

static STARTED: OnceLock<Instant> = OnceLock::new();
static CURRENT: Mutex<State> = Mutex::new(State::EMPTY);

#[derive(Clone)]
struct State {
    logged_in: bool,
    premium: bool,
    quality: String,
    locale: String,
}

impl State {
    const EMPTY: State = State {
        logged_in: false,
        premium: false,
        quality: String::new(),
        locale: String::new(),
    };
}

#[derive(Serialize)]
pub struct Route {
    pub main: String,
    pub star: String,
}

#[derive(Serialize)]
pub struct SessionJson {
    pub uptime_s: u64,
    pub logged_in: bool,
    pub premium: bool,
    pub quality: String,
    pub route: Route,
}

pub fn start() {
    STARTED.get_or_init(Instant::now);
}

pub fn set(logged_in: bool, premium: bool, quality: String, locale: String) {
    *CURRENT.lock().unwrap_or_else(|poison| poison.into_inner()) = State {
        logged_in,
        premium,
        quality,
        locale,
    };
}

pub fn locale() -> String {
    CURRENT
        .lock()
        .unwrap_or_else(|poison| poison.into_inner())
        .locale
        .clone()
}

pub fn snapshot(route: Route) -> SessionJson {
    let state = CURRENT
        .lock()
        .unwrap_or_else(|poison| poison.into_inner())
        .clone();
    SessionJson {
        uptime_s: STARTED
            .get()
            .map_or(0, |started| started.elapsed().as_secs()),
        logged_in: state.logged_in,
        premium: state.premium,
        quality: state.quality,
        route,
    }
}

pub fn route_of(attempts: &[Attempt]) -> Route {
    let last = |star: bool| {
        attempts
            .iter()
            .rev()
            .filter(|attempt| attempt.ok() && attempt.service == "api")
            .find(|attempt| attempt.origin.starts_with("api-star") == star)
            .map_or_else(|| "unknown".to_string(), named)
    };
    Route {
        main: last(false),
        star: last(true),
    }
}

fn named(attempt: &Attempt) -> String {
    match attempt.tier {
        Tier::Direct => "direct".to_string(),
        Tier::Relay => format!("relay:{}", attempt.hop),
        Tier::Pro => format!("pro:{}", attempt.hop),
    }
}

mod meter;
mod probe;

#[cfg(test)]
mod tests;

use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard, OnceLock};
use std::time::{Duration, Instant};

use wreq::Client;

use crate::app::diagnostics;
use crate::network::edge::{self, Hop, Tier};

pub use self::meter::Meter;

const SLOW_SPEED: u64 = 96 * 1024;
const SLOW_IN_A_ROW: u8 = 2;
const CHECK_GAP: Duration = Duration::from_secs(120);
const EVEN_GAP: Duration = Duration::from_secs(600);
const PENALTY: Duration = Duration::from_secs(600);
const FASTER: f64 = 1.5;
const PROBE_BYTES: u64 = 512 * 1024;
const PROBE_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Default)]
struct Speed {
    slow_samples: HashMap<String, u8>,
    quiet_until: Option<Instant>,
}

impl Speed {
    fn sampled(&mut self, node: &str, speed: u64) -> bool {
        let in_a_row = self.slow_samples.entry(node.to_string()).or_default();
        *in_a_row = if speed < SLOW_SPEED { *in_a_row + 1 } else { 0 };
        if *in_a_row < SLOW_IN_A_ROW {
            return false;
        }
        *in_a_row = 0;
        true
    }

    fn check_due(&mut self, node: &str, pool: &[String], now: Instant) -> bool {
        let first = pool.len() >= 2 && pool[0] == node;
        if !first || self.quiet_until.is_some_and(|until| now < until) {
            return false;
        }
        self.quiet_until = Some(now + CHECK_GAP);
        true
    }

    fn even(&mut self, now: Instant) {
        self.quiet_until = Some(now + EVEN_GAP);
    }
}

static SPEED: OnceLock<Mutex<Speed>> = OnceLock::new();
static CLIENT: OnceLock<Client> = OnceLock::new();

fn lock() -> MutexGuard<'static, Speed> {
    match SPEED.get_or_init(|| Mutex::new(Speed::default())).lock() {
        Ok(guard) => guard,
        Err(poison) => poison.into_inner(),
    }
}

pub fn attach(client: Client) {
    CLIENT.set(client).ok();
}

pub fn failed(hop: &Hop) {
    if let Some(node) = node_of(hop) {
        slow(&node);
    }
}

fn node_of(hop: &Hop) -> Option<String> {
    if hop.tier != Tier::Relay {
        return None;
    }
    let url = url::Url::parse(&hop.url).ok()?;
    let rest = url
        .host_str()?
        .strip_suffix(edge::relay_zone())?
        .strip_suffix('.')?;
    let (_, node) = rest.split_once('.')?;
    Some(node.to_string())
}

fn sampled(node: &str, speed: u64) {
    let turned_slow = lock().sampled(node, speed);
    if turned_slow {
        slow(node);
    }
}

fn slow(node: &str) {
    let Some(client) = CLIENT.get() else {
        return;
    };
    let pool = edge::relay_pool();
    let due = lock().check_due(node, &pool, Instant::now());
    if due {
        tokio::spawn(check(client.clone(), node.to_string(), pool));
    }
}

async fn check(client: Client, current: String, pool: Vec<String>) {
    let speeds = probe::measure(&client, &pool).await;
    let slower = probe::slower(&current, &speeds);
    let measured = speeds
        .iter()
        .map(|(node, speed)| format!("{node}={}", speed / 1024))
        .collect::<Vec<_>>()
        .join(" ");
    if slower.is_empty() {
        lock().even(Instant::now());
        diagnostics::log(
            "INFO",
            format!(
                "[RelaySpeed] {current} slow, {measured} KB/s: about even, no check for {} min",
                EVEN_GAP.as_secs() / 60
            ),
        );
        return;
    }
    edge::demote_relays(&slower, PENALTY);
    let first = edge::relay_pool().into_iter().next().unwrap_or_default();
    diagnostics::log(
        "INFO",
        format!(
            "[RelaySpeed] {current} slow, {measured} KB/s: {first} first, {} back for {} min",
            slower.join(","),
            PENALTY.as_secs() / 60
        ),
    );
}

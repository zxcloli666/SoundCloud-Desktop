use std::time::Duration;

use tokio::sync::Notify;
use tokio::time::Instant;

const MIN_ROUND_GAP: Duration = Duration::from_secs(15);
const NUDGE_FLOOR: Duration = Duration::from_secs(180);

pub async fn wait(nudge: &Notify, interval: Duration, relays_down: bool) {
    let finished = Instant::now();
    let floor = if relays_down {
        Duration::ZERO
    } else {
        NUDGE_FLOOR.min(interval)
    };
    tokio::select! {
        _ = tokio::time::sleep(interval) => {}
        _ = nudge.notified() => {
            let settled = Instant::now() + MIN_ROUND_GAP;
            tokio::time::sleep_until(settled.max(finished + floor)).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::time::Duration;

    use tokio::sync::Notify;
    use tokio::time::Instant;

    use super::{MIN_ROUND_GAP, NUDGE_FLOOR, wait};

    const INTERVAL: Duration = Duration::from_secs(300);
    const ROUND: Duration = Duration::from_secs(5);
    const POLL: Duration = Duration::from_secs(10);

    fn nudge_every(period: Duration) -> Arc<Notify> {
        let nudge = Arc::new(Notify::new());
        let sender = nudge.clone();
        tokio::spawn(async move {
            loop {
                sender.notify_one();
                tokio::time::sleep(period).await;
            }
        });
        nudge
    }

    async fn rounds_within(span: Duration, nudge: &Notify, relays_down: bool) -> usize {
        let started = Instant::now();
        let mut rounds = 0;
        while started.elapsed() < span {
            rounds += 1;
            tokio::time::sleep(ROUND).await;
            wait(nudge, INTERVAL, relays_down).await;
        }
        rounds
    }

    #[tokio::test(start_paused = true)]
    async fn a_quiet_network_waits_the_whole_interval() {
        let nudge = Notify::new();
        let started = Instant::now();
        wait(&nudge, INTERVAL, false).await;
        assert_eq!(started.elapsed(), INTERVAL);
    }

    #[tokio::test(start_paused = true)]
    async fn a_nudge_right_after_a_round_waits_for_the_floor() {
        let nudge = Notify::new();
        nudge.notify_one();
        let started = Instant::now();
        wait(&nudge, INTERVAL, false).await;
        assert_eq!(started.elapsed(), NUDGE_FLOOR);
    }

    #[tokio::test(start_paused = true)]
    async fn a_late_nudge_still_gets_its_settle_gap() {
        let nudge = Arc::new(Notify::new());
        let sender = nudge.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(200)).await;
            sender.notify_one();
        });
        let started = Instant::now();
        wait(&nudge, INTERVAL, false).await;
        assert_eq!(started.elapsed(), Duration::from_secs(200) + MIN_ROUND_GAP);
    }

    #[tokio::test(start_paused = true)]
    async fn a_nudge_after_every_relay_failed_reprobes_soon() {
        let nudge = Notify::new();
        nudge.notify_one();
        let started = Instant::now();
        wait(&nudge, INTERVAL, true).await;
        assert_eq!(started.elapsed(), MIN_ROUND_GAP);
    }

    #[tokio::test(start_paused = true)]
    async fn a_nudge_every_poll_for_an_hour_runs_at_most_one_round_per_floor() {
        let hour = Duration::from_secs(3600);
        let nudge = nudge_every(POLL);
        let rounds = rounds_within(hour, &nudge, false).await;
        let quiet = rounds_within(hour, &Notify::new(), false).await;
        assert_eq!(quiet, 12);
        assert_eq!(rounds, 20);
    }

    #[tokio::test(start_paused = true)]
    async fn a_dead_network_with_a_flapping_link_keeps_reprobing_fast() {
        let hour = Duration::from_secs(3600);
        let nudge = nudge_every(POLL);
        let rounds = rounds_within(hour, &nudge, true).await;
        assert!(rounds > 100, "{rounds} rounds");
    }
}

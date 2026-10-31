use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Notify;

const POLL_INTERVAL: Duration = Duration::from_secs(10);
const ROUTE_TARGET: SocketAddr = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(1, 1, 1, 1)), 443);

pub async fn run(nudge: Arc<Notify>) {
    watch(nudge, primary_route).await
}

async fn watch(nudge: Arc<Notify>, route: impl Fn() -> Option<Ipv4Addr>) {
    let mut watch = Watch::new(route());
    let mut interval = tokio::time::interval(POLL_INTERVAL);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        interval.tick().await;
        if watch.moved(route()) {
            nudge.notify_one();
        }
    }
}

fn primary_route() -> Option<Ipv4Addr> {
    let socket = UdpSocket::bind((Ipv4Addr::UNSPECIFIED, 0)).ok()?;
    socket.connect(ROUTE_TARGET).ok()?;
    match socket.local_addr().ok()?.ip() {
        IpAddr::V4(local) if !local.is_unspecified() => Some(local),
        _ => None,
    }
}

struct Watch {
    settled: Option<Ipv4Addr>,
    seen: Option<Ipv4Addr>,
}

impl Watch {
    fn new(route: Option<Ipv4Addr>) -> Self {
        Self {
            settled: route,
            seen: route,
        }
    }

    fn moved(&mut self, route: Option<Ipv4Addr>) -> bool {
        let moved = route == self.seen && route != self.settled;
        if moved {
            self.settled = route;
        }
        self.seen = route;
        moved
    }
}

#[cfg(test)]
mod tests {
    use std::net::{IpAddr, Ipv4Addr};
    use std::sync::Arc;
    use std::sync::atomic::{AtomicUsize, Ordering};

    use tokio::sync::Notify;

    use super::{POLL_INTERVAL, Watch, primary_route, watch};

    const HOME: Option<Ipv4Addr> = Some(Ipv4Addr::new(192, 168, 1, 23));
    const VPN: Option<Ipv4Addr> = Some(Ipv4Addr::new(10, 8, 0, 2));

    #[test]
    fn a_steady_route_never_moves() {
        let mut watch = Watch::new(HOME);
        assert!((0..100).all(|_| !watch.moved(HOME)));
    }

    #[test]
    fn a_route_that_drops_for_one_poll_is_not_a_network_change() {
        let mut watch = Watch::new(HOME);
        for _ in 0..50 {
            assert!(!watch.moved(None));
            assert!(!watch.moved(HOME));
        }
    }

    #[test]
    fn a_route_that_flips_every_poll_never_settles() {
        let mut watch = Watch::new(HOME);
        for _ in 0..50 {
            assert!(!watch.moved(VPN));
            assert!(!watch.moved(HOME));
        }
    }

    #[test]
    fn a_new_route_moves_once_it_holds_for_two_polls() {
        let mut watch = Watch::new(HOME);
        assert!(!watch.moved(VPN));
        assert!(watch.moved(VPN));
        assert!(!watch.moved(VPN));
        assert!(!watch.moved(None));
        assert!(watch.moved(None));
        assert!(!watch.moved(HOME));
        assert!(watch.moved(HOME));
    }

    #[test]
    fn the_route_is_a_stable_address_of_this_machine() {
        let Some(route) = primary_route() else {
            return;
        };
        let interfaces = if_addrs::get_if_addrs().unwrap();
        assert!(
            interfaces
                .iter()
                .any(|interface| !interface.is_loopback() && interface.ip() == IpAddr::V4(route))
        );
        assert!((0..20).all(|_| primary_route() == Some(route)));
    }

    #[tokio::test(start_paused = true)]
    async fn a_blinking_route_sends_no_nudge() {
        let nudge = Arc::new(Notify::new());
        let polls = Arc::new(AtomicUsize::new(0));
        let counter = polls.clone();
        tokio::spawn(watch(nudge.clone(), move || {
            let poll = counter.fetch_add(1, Ordering::SeqCst);
            if poll % 2 == 0 { HOME } else { None }
        }));

        let nudged = tokio::time::timeout(POLL_INTERVAL * 60, nudge.notified()).await;
        assert!(nudged.is_err());
        assert!(polls.load(Ordering::SeqCst) >= 60);
    }

    #[tokio::test(start_paused = true)]
    async fn a_real_route_change_sends_one_nudge() {
        let nudge = Arc::new(Notify::new());
        let polls = Arc::new(AtomicUsize::new(0));
        let counter = polls.clone();
        tokio::spawn(watch(nudge.clone(), move || {
            if counter.fetch_add(1, Ordering::SeqCst) < 5 {
                HOME
            } else {
                VPN
            }
        }));

        let nudged = tokio::time::timeout(POLL_INTERVAL * 10, nudge.notified()).await;
        assert!(nudged.is_ok());
        let again = tokio::time::timeout(POLL_INTERVAL * 60, nudge.notified()).await;
        assert!(again.is_err());
    }
}

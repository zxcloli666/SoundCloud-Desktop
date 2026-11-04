use std::sync::Arc;
use std::sync::atomic::{AtomicI64, AtomicUsize, Ordering};
use std::time::Duration;

use sc_chat::Millis;
use warp::Filter;

use super::rig::Rig;

impl Rig {
    pub fn answering(
        &self,
        status: u16,
        jump: Millis,
        hold: Duration,
    ) -> (String, Arc<AtomicUsize>) {
        let (host, hits) = (self.host.clone(), Arc::new(AtomicUsize::new(0)));
        let jump = Arc::new(AtomicI64::new(jump));
        let counted = hits.clone();
        let route = warp::any().and_then(move || {
            let (host, jump, counted) = (host.clone(), jump.clone(), counted.clone());
            async move {
                counted.fetch_add(1, Ordering::SeqCst);
                host.now
                    .fetch_add(jump.swap(0, Ordering::SeqCst), Ordering::SeqCst);
                tokio::time::sleep(hold).await;
                let status = warp::http::StatusCode::from_u16(status).unwrap();
                Ok::<_, warp::Rejection>(warp::reply::with_status("", status))
            }
        });
        let (addr, server) = warp::serve(route).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(server);
        (format!("http://{addr}"), hits)
    }
}

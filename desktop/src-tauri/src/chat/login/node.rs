use std::sync::Arc;

use sc_chat::Transport;

use crate::chat::transport::{EdgeTransport, Route};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Node {
    Main,
    Star,
}

impl Node {
    pub const ALL: [Node; 2] = [Node::Main, Node::Star];
}

pub struct Nodes {
    main: Arc<dyn Transport>,
    star: Arc<dyn Transport>,
}

impl Nodes {
    pub fn new(main: Arc<dyn Transport>, star: Arc<dyn Transport>) -> Self {
        Self { main, star }
    }

    pub fn edge() -> Self {
        Self::new(
            Arc::new(EdgeTransport::new(Route::auth_main())),
            Arc::new(EdgeTransport::new(Route::auth_star())),
        )
    }

    pub fn transport(&self, node: Node) -> &dyn Transport {
        match node {
            Node::Main => self.main.as_ref(),
            Node::Star => self.star.as_ref(),
        }
    }
}

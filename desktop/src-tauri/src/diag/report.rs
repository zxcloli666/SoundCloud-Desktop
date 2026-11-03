use backend_contracts::diag::ErrorKind;

use super::errors::{self, ErrorInput};
use super::{queue, trace};

pub fn error(input: ErrorInput) -> usize {
    if matches!(
        input.kind,
        ErrorKind::Render | ErrorKind::Request | ErrorKind::Playback
    ) {
        trace::open_debug();
    }
    let entry = errors::entry_of(input);
    errors::record(entry.clone());
    queue::push(entry)
}

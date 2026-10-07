import { useShallow } from 'zustand/shallow';
import { useAddToPlaylistRequest } from '../../stores/add-to-playlist';
import { AddToPlaylistDialog } from './AddToPlaylistDialog';

export function AddToPlaylistHost() {
  const { open, trackUrns, setOpen } = useAddToPlaylistRequest(
    useShallow((s) => ({ open: s.open, trackUrns: s.trackUrns, setOpen: s.setOpen })),
  );
  return <AddToPlaylistDialog trackUrns={trackUrns} open={open} onOpenChange={setOpen} />;
}

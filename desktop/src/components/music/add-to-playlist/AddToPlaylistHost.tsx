import { useAddToPlaylistRequest } from '../../../stores/add-to-playlist';
import { Modal, ModalContent } from '../../ui/Modal';
import { PlaylistPicker } from './PlaylistPicker';

export function AddToPlaylistHost() {
  const open = useAddToPlaylistRequest((s) => s.open);
  const track = useAddToPlaylistRequest((s) => s.track);
  const close = useAddToPlaylistRequest((s) => s.close);

  return (
    <Modal open={open} onOpenChange={(next) => !next && close()}>
      <ModalContent size="sm">
        {track && <PlaylistPicker key={track.urn} track={track} />}
      </ModalContent>
    </Modal>
  );
}

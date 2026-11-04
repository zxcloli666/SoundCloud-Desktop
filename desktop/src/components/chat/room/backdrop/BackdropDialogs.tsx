import { memo, useEffect, useRef } from 'react';
import type { RoomView } from '../../../../lib/together/types';
import { useBackdropStore } from '../../../../stores/chat/backdrop';
import { Modal, ModalContent } from '../../../ui/Modal';
import { BackdropPicker } from '../BackdropPicker';
import { ReportBackdrop } from './ReportBackdrop';
import { useRoomBackdrop } from './shown';

export const BackdropDialogs = memo(function BackdropDialogs({
  room,
  host,
}: {
  room: RoomView;
  host: boolean;
}) {
  const dialog = useBackdropStore((state) => state.dialog);
  const close = useBackdropStore((state) => state.close);
  const { conversationId, imageId, hidden } = useRoomBackdrop(room);
  const shown = useRef(dialog);
  const reported = useRef(imageId);
  if (dialog) shown.current = dialog;
  if (dialog !== 'report') reported.current = imageId;
  const view = shown.current;
  const misplaced =
    (dialog === 'picker' && !host) || (dialog === 'report' && (host || !reported.current));

  useEffect(() => {
    if (misplaced) close();
  }, [misplaced, close]);

  useEffect(() => close, [close]);

  return (
    <Modal open={dialog !== null && !misplaced} onOpenChange={(open) => !open && close()}>
      <ModalContent size={view === 'picker' ? 'md' : 'sm'} showClose={view === 'picker'}>
        {view === 'picker' && <BackdropPicker room={room} onClose={close} />}
        {view === 'report' && conversationId && reported.current && (
          <ReportBackdrop
            conversationId={conversationId}
            mediaId={reported.current}
            hidden={hidden}
            onClose={close}
          />
        )}
      </ModalContent>
    </Modal>
  );
});

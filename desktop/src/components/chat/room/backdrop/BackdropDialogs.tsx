import { memo, useCallback, useEffect, useRef } from 'react';
import type { RoomView } from '../../../../lib/together/types';
import { useBackdropStore } from '../../../../stores/chat/backdrop';
import { Modal, ModalContent } from '../../../ui/Modal';
import { BackdropPicker } from '../BackdropPicker';
import { keepKeys } from './keys';
import { ReportBackdrop } from './ReportBackdrop';
import { useRoomBackdrop } from './shown';

let hosts = 0;

function useHostCount() {
  useEffect(() => {
    hosts += 1;
    return () => {
      hosts -= 1;
      setTimeout(() => {
        if (hosts === 0) useBackdropStore.getState().close();
      }, 0);
    };
  }, []);
}

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

  useHostCount();

  useEffect(() => {
    if (misplaced) close();
  }, [misplaced, close]);

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) close();
    },
    [close],
  );

  return (
    <Modal open={dialog !== null && !misplaced} onOpenChange={onOpenChange}>
      <ModalContent size={view === 'picker' ? 'md' : 'sm'} showClose={view === 'picker'}>
        <div onKeyDown={keepKeys}>
          {view === 'picker' && <BackdropPicker room={room} onClose={close} />}
          {view === 'report' && conversationId && reported.current && (
            <ReportBackdrop
              conversationId={conversationId}
              mediaId={reported.current}
              hidden={hidden}
              onClose={close}
            />
          )}
        </div>
      </ModalContent>
    </Modal>
  );
});

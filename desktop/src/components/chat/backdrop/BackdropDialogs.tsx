import { memo, useCallback, useEffect, useRef } from 'react';
import type { ConvId } from '../../../lib/chat/types';
import { selectDialog, useBackdropStore } from '../../../stores/chat/backdrop';
import { Modal, ModalContent } from '../../ui/Modal';
import { BackdropPicker } from './BackdropPicker';
import { keepKeys } from './keys';
import { ReportBackdrop } from './ReportBackdrop';
import { useBackdropView } from './shown';
import type { BackdropTarget } from './target';

const hosts = new Map<ConvId | null, number>();

function useHostCount(scope: ConvId | null) {
  useEffect(() => {
    hosts.set(scope, (hosts.get(scope) ?? 0) + 1);
    return () => {
      hosts.set(scope, (hosts.get(scope) ?? 1) - 1);
      setTimeout(() => {
        const store = useBackdropStore.getState();
        if (!hosts.get(scope) && store.dialog?.scope === scope) store.close();
      }, 0);
    };
  }, [scope]);
}

export const BackdropDialogs = memo(function BackdropDialogs({
  scope,
  target,
  reportable,
}: {
  scope: ConvId | null;
  target: BackdropTarget;
  reportable: boolean;
}) {
  const dialog = useBackdropStore(selectDialog(scope));
  const close = useBackdropStore((state) => state.close);
  const { imageId, hidden } = useBackdropView(target.conversationId, target.backdrop);
  const shown = useRef(dialog);
  const reported = useRef(imageId);
  if (dialog) shown.current = dialog;
  if (dialog !== 'report') reported.current = imageId;
  const view = shown.current;
  const misplaced = dialog === 'report' && (!reportable || !reported.current);

  useHostCount(scope);

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
          {view === 'picker' && <BackdropPicker target={target} onClose={close} />}
          {view === 'report' && target.conversationId && reported.current && (
            <ReportBackdrop
              conversationId={target.conversationId}
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

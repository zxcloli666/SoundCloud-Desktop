import React from 'react';
import { X } from '../../lib/icons';
import { useNetCheckStore } from '../../lib/net/check';
import { Modal, ModalClose, ModalContent } from '../ui/Modal';
import { HostRows } from './HostRows';
import { ManualSteps } from './ManualSteps';
import { NetCheckActions } from './NetCheckActions';
import { VerdictHeader } from './VerdictHeader';

export const NetCheckModal = React.memo(() => {
  const open = useNetCheckStore((s) => s.open);
  const closeCheck = useNetCheckStore((s) => s.closeCheck);

  return (
    <Modal open={open} onOpenChange={(next) => !next && closeCheck()}>
      <ModalContent size="md" zClass="z-[95]" showClose={false}>
        <ModalClose className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/[0.06] transition-colors cursor-pointer">
          <X size={14} />
        </ModalClose>
        <div
          className="relative min-h-0 overflow-y-auto px-7 pt-7 pb-1"
          style={{ isolation: 'isolate' }}
        >
          <VerdictHeader />
          <HostRows />
          <ManualSteps />
        </div>
        <div className="shrink-0 px-7 pt-5 pb-7">
          <NetCheckActions />
        </div>
      </ModalContent>
    </Modal>
  );
});

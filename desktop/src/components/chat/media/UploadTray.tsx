import { memo } from 'react';
import type { ConvId } from '../../../lib/chat/types';
import { TrayPanel } from './compose/TrayPanel';
import { useTrayWork } from './compose/useTrayWork';

export const UploadTray = memo(function UploadTray({
  conversationId,
  onSpace,
}: {
  conversationId?: ConvId;
  onSpace?: (px: number) => void;
}) {
  const current = conversationId ?? null;
  const work = useTrayWork(current);
  return (
    <TrayPanel
      work={work}
      current={current}
      place={current ? 'thread' : 'dock'}
      onSpace={onSpace}
    />
  );
});

import { memo } from 'react';
import type { ConvId } from '../../../lib/chat/types';
import { TrayPanel } from './compose/TrayPanel';
import { useGlobalTrayWork, useThreadTrayWork } from './compose/useTrayWork';

const ThreadTray = memo(function ThreadTray({ conversationId }: { conversationId: ConvId }) {
  const work = useThreadTrayWork(conversationId);
  return <TrayPanel work={work} showChat={false} place="thread" />;
});

const DockTray = memo(function DockTray({ except }: { except: ConvId | null }) {
  const work = useGlobalTrayWork(except);
  return <TrayPanel work={work} showChat place="dock" />;
});

export const UploadTray = memo(function UploadTray({
  conversationId,
  except = null,
}: {
  conversationId?: ConvId;
  except?: ConvId | null;
}) {
  return conversationId ? (
    <ThreadTray conversationId={conversationId} />
  ) : (
    <DockTray except={except} />
  );
});

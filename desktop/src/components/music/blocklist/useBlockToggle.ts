import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { blockArtist, unblockArtist, useIsBlocked } from '../../../lib/blocked-artists';
import type { BlockTarget } from './targets';

export function useBlockToggle(target: BlockTarget | null) {
  const { t } = useTranslation();
  const blocked = useIsBlocked(target?.kind ?? 'user', target?.id);
  const [busy, setBusy] = useState(false);

  const block = useCallback(
    async (next: BlockTarget) => {
      setBusy(true);
      const ok = await blockArtist(next);
      setBusy(false);
      if (!ok) {
        toast.error(t('blocklist.failed'));
        return;
      }
      toast(t('blocklist.toastBlocked', { name: next.name }), {
        action: {
          label: t('blocklist.undo'),
          onClick: () => void unblockArtist(next.kind, next.id),
        },
      });
    },
    [t],
  );

  const unblock = useCallback(
    async (next: BlockTarget) => {
      setBusy(true);
      const ok = await unblockArtist(next.kind, next.id);
      setBusy(false);
      if (!ok) {
        toast.error(t('blocklist.failed'));
        return;
      }
      toast(t('blocklist.toastUnblocked', { name: next.name }));
    },
    [t],
  );

  const toggle = useCallback(() => {
    if (!target || busy) return;
    void (blocked ? unblock(target) : block(target));
  }, [target, busy, blocked, block, unblock]);

  return { blocked, busy, toggle, block, unblock };
}

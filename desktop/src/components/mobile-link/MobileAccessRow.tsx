import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleCheck, LinkIcon, Loader2, TriangleAlert } from '../../lib/icons';
import {
  fetchMobileAccess,
  MOBILE_ACCESS_KEY,
  type MobileAccess,
  unlinkMobile,
} from '../../lib/mobile-link/api';
import { Row } from '../settings/primitives';
import { MobileLinkDialog } from './MobileLinkDialog';
import { PRIMARY_BUTTON, QUIET_BUTTON, TONE_CLASS, type Tone } from './styles';

type Kind = 'off' | 'active' | 'relink';

const KINDS: Record<Kind, { tone: Tone; label: string; action: string }> = {
  off: { tone: 'idle', label: 'mobileLink.state.off', action: 'mobileLink.link' },
  active: { tone: 'ok', label: 'mobileLink.state.active', action: 'mobileLink.unlink' },
  relink: { tone: 'warn', label: 'mobileLink.state.relink', action: 'mobileLink.relink' },
};

function kindOf(access: MobileAccess): Kind {
  if (!access.linked) return 'off';
  return access.status === 'relink_required' ? 'relink' : 'active';
}

function StateIcon({ kind }: { kind: Kind }) {
  if (kind === 'active') return <CircleCheck size={12} />;
  if (kind === 'relink') return <TriangleAlert size={12} />;
  return <LinkIcon size={12} />;
}

export function MobileAccessRow() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const { data } = useQuery({
    queryKey: MOBILE_ACCESS_KEY,
    queryFn: fetchMobileAccess,
    staleTime: 60_000,
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: MOBILE_ACCESS_KEY });
  const unlink = useMutation({ mutationFn: unlinkMobile, onSettled: refresh });

  if (!data?.available) return null;
  const kind = kindOf(data);
  const look = KINDS[kind];
  const unlinking = kind === 'active';

  return (
    <div className="mb-4 border-b border-ink/[0.05] pb-4">
      <Row title={t('mobileLink.title')}>
        <span
          data-ui="mobile-access-badge"
          data-state={kind}
          role="status"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11.5px] font-semibold ${TONE_CLASS[look.tone]}`}
        >
          <StateIcon kind={kind} />
          {t(look.label)}
        </span>
        <button
          type="button"
          disabled={unlink.isPending}
          onClick={() => (unlinking ? unlink.mutate() : setDialog(true))}
          className={unlinking ? QUIET_BUTTON : PRIMARY_BUTTON}
        >
          {unlink.isPending && <Loader2 size={12} className="motion-safe:animate-spin" />}
          {t(look.action)}
        </button>
      </Row>
      <MobileLinkDialog open={dialog} onOpenChange={setDialog} onCompleted={refresh} />
    </div>
  );
}

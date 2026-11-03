import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Star } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { moveSuperlike, removeSuperlike } from '../../../lib/superlike-actions';
import { FREE_SUPERLIKES, useSuperlikeQuota, useSuperlikesWarm } from '../../../lib/superlikes';
import type { Track } from '../../../stores/player';
import { useSuperlikeLimit } from '../../../stores/superlike-limit';
import { Modal, ModalContent, ModalDescription, ModalTitle } from '../../ui/Modal';
import { SlotPicker } from './SlotPicker';
import { StarBadgeLink } from './StarBadgeLink';
import { SuperHeart } from './SuperHeart';

export function SuperlikeLimitHost() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const perf = usePerfMode();
  const wanted = useSuperlikeLimit((s) => s.wanted);
  const close = useSuperlikeLimit((s) => s.close);
  const quota = useSuperlikeQuota().data;
  const toFree = quota?.limit == null ? 1 : Math.max(1, quota.used - quota.limit + 1);
  useSuperlikesWarm();

  const openStar = () => {
    close();
    navigate('/star');
  };

  const pick = async (from: Track) => {
    if (!wanted) return;
    if (toFree > 1) {
      await removeSuperlike(from);
      return;
    }
    close();
    if (await moveSuperlike(from, wanted)) toast.success(t('superlike.moved'));
  };

  return (
    <Modal open={!!wanted} onOpenChange={(open) => !open && close()}>
      <ModalContent size="md">
        <div className="relative px-7 pb-7 pt-9 text-center">
          {perf.bloom && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-2 h-40 w-72 rounded-full opacity-60"
              style={{
                background:
                  'radial-gradient(closest-side, var(--color-superlike-glow), transparent)',
                contain: 'strict',
                transform: 'translateX(-50%) translateZ(0)',
              }}
            />
          )}
          <div className="relative flex flex-col items-center" style={{ isolation: 'isolate' }}>
            <SuperHeart size={52} />
            <ModalTitle className="mt-5 text-[21px] font-black leading-snug tracking-tight text-ink-95">
              <Trans
                i18nKey="superlike.limitTitle"
                components={{ star: <StarBadgeLink size="lg" onNavigate={close} /> }}
              />
            </ModalTitle>
            <ModalDescription className="mt-2.5 max-w-sm text-[13px] leading-relaxed text-ink-50">
              {t('superlike.limitBody', { count: FREE_SUPERLIKES })}
            </ModalDescription>
            <button
              type="button"
              onClick={openStar}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-superlike-from via-superlike-via to-superlike-to px-6 text-[14px] font-bold text-white shadow-[0_8px_28px_var(--color-superlike-glow)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97] cursor-pointer"
            >
              <Star size={16} fill="currentColor" />
              {t('superlike.getStar')}
            </button>
          </div>
          <div className="relative text-left">
            <SlotPicker toFree={toFree} onPick={(track) => void pick(track)} />
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

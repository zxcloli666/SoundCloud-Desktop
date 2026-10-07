import { useTranslation } from 'react-i18next';
import { Ban, Loader2 } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import type { BlockTarget } from './targets';
import { useBlockToggle } from './useBlockToggle';

export function BlockArtistButton({ target }: { target: BlockTarget | null }) {
  const { t } = useTranslation();
  const blur = usePerfMode().blur(20);
  const { blocked, busy, toggle } = useBlockToggle(target);
  if (!target) return null;

  const idleBg =
    blur > 0
      ? 'bg-white/[0.04] hover:bg-white/[0.08]'
      : 'bg-[rgba(28,28,32,0.85)] hover:bg-[rgba(44,44,50,0.9)]';

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={blocked}
      title={blocked ? t('blocklist.unblock') : t('blocklist.playerHint')}
      className={`group inline-flex items-center gap-1.5 h-11 px-5 rounded-full border-[0.5px] text-[12px] font-medium transition-all duration-300 ease-[var(--ease-apple)] cursor-pointer disabled:opacity-60 ${
        blocked
          ? 'bg-rose-500/10 border-rose-400/25 text-rose-300 hover:bg-rose-500/15'
          : `${idleBg} border-white/[0.08] text-white/50 hover:text-rose-300 hover:border-rose-400/25`
      }`}
      style={{
        backdropFilter: blur > 0 ? `blur(${blur}px)` : undefined,
        WebkitBackdropFilter: blur > 0 ? `blur(${blur}px)` : undefined,
      }}
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />}
      {blocked ? (
        <>
          <span className="group-hover:hidden">{t('blocklist.blocked')}</span>
          <span className="hidden group-hover:inline">{t('blocklist.unblock')}</span>
        </>
      ) : (
        t('blocklist.block')
      )}
    </button>
  );
}

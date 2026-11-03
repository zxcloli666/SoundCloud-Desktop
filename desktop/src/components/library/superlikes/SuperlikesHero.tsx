import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loader2, Play, Shuffle } from '../../../lib/icons';
import type { SuperlikeQuota } from '../../../lib/superlikes';
import { StarBadge } from '../../layout/StarSubscription';
import { SuperHeart } from '../../music/superlike/SuperHeart';
import { SparkleField } from './SparkleField';

export const SuperlikesHero = memo(function SuperlikesHero({
  quota,
  canPlay,
  loading,
  onPlay,
  onShuffle,
}: {
  quota: SuperlikeQuota | undefined;
  canPlay: boolean;
  loading: boolean;
  onPlay: () => void;
  onShuffle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="relative mb-6 overflow-hidden rounded-[28px] border border-ink/[0.07] px-6 py-6 md:px-8"
      style={{
        background:
          'linear-gradient(125deg, color-mix(in srgb, var(--color-superlike-from) 20%, transparent), color-mix(in srgb, var(--color-superlike-via) 14%, transparent) 45%, color-mix(in srgb, var(--color-superlike-to) 16%, transparent))',
      }}
    >
      <SparkleField />
      <div className="relative flex flex-wrap items-center gap-5" style={{ isolation: 'isolate' }}>
        <SuperHeart size={60} />
        <div className="min-w-0 flex-1 basis-60">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-50">
            {t('superlikes.kicker')}
          </p>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-ink-90">
            {t('superlikes.tagline')}
          </p>
          <QuotaLine quota={quota} />
        </div>
        {canPlay && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPlay}
              disabled={loading}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-superlike-from via-superlike-via to-superlike-to px-5 text-[13px] font-bold text-white shadow-[0_8px_24px_var(--color-superlike-glow)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97] cursor-pointer disabled:opacity-60"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} fill="currentColor" />}
              {t('superlikes.playAll')}
            </button>
            <button
              type="button"
              onClick={onShuffle}
              disabled={loading}
              title={t('superlikes.shuffle')}
              aria-label={t('superlikes.shuffle')}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-ink/[0.1] bg-ink/[0.06] text-ink-80 transition-all duration-200 hover:bg-ink/[0.1] hover:text-ink cursor-pointer disabled:opacity-60"
            >
              <Shuffle size={16} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
});

function QuotaLine({ quota }: { quota: SuperlikeQuota | undefined }) {
  const { t } = useTranslation();
  if (!quota) return null;
  if (quota.limit == null) {
    return (
      <p className="mt-3 text-[12.5px] font-semibold text-ink-60 tabular-nums">
        {t('superlikes.count', { count: quota.used })}
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2.5">
      <span className="rounded-full bg-shade-25 px-3 py-1 text-[12.5px] font-bold text-ink-85 tabular-nums">
        {t('superlikes.usedOf', { used: quota.used, limit: quota.limit })}
      </span>
      <Link
        to="/star"
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/[0.1] bg-ink/[0.05] py-0.5 pl-3 pr-1 text-[12px] font-semibold text-ink-75 transition-colors hover:bg-ink/[0.1] hover:text-ink"
      >
        {t('superlikes.unlimitedWith')}
        <StarBadge />
      </Link>
    </div>
  );
}

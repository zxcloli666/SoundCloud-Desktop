import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Gift, KeyRound, Plus, Users } from '../../../../lib/icons';
import { daysUntil, passDate } from '../../../../lib/star-format';
import { usePaySubscription } from '../../../../lib/star-offer';
import { type StarStatus, useStarStatus } from '../../../../lib/star-status';
import { useOwnTenure } from '../../../../lib/star-tenure';
import { useAuthStore } from '../../../../stores/auth';
import { StarBadge } from '../../../layout/StarBadge';
import { tileOf } from '../../methods';
import { useFlowApi } from '../flow/derive';
import { primarySource, type Step } from '../meta';

const R = 52;
const C = 2 * Math.PI * R;

function toneOf(status: StarStatus | null): string {
  if (status?.kind === 'relink') return 'rgb(var(--bad))';
  if (status?.kind === 'confirm') return 'var(--color-amber-400)';
  if (status?.kind === 'ends' && status.level === 'urgent') return 'rgb(var(--bad))';
  if (status?.kind === 'ends' && status.level === 'soon') return 'var(--color-amber-400)';
  return 'rgb(var(--ok))';
}

function useHeadline(status: StarStatus | null, endsAt: number) {
  const { t } = useTranslation();
  if (!status) return { head: passDate(endsAt), sub: '' };
  switch (status.kind) {
    case 'renews':
      return {
        head: passDate(status.at),
        sub: `${status.charge} · ${t(`starpass.method.${tileOf(status.method).i18n}.title`)}`,
      };
    case 'relink':
      return { head: t('star.relink'), sub: passDate(status.at) };
    case 'confirm':
      return { head: t('star.confirmPay'), sub: `${status.charge} · ${passDate(status.at)}` };
    case 'open':
      return { head: t('star.active'), sub: t(`starpass.manage.sources.${status.category}`) };
    default:
      return {
        head: passDate(status.at),
        sub: t('starMoments.expiry.left', { count: daysUntil(status.at) }),
      };
  }
}

const ACTIONS: { id: string; Icon: typeof Plus; label: string; step: Step }[] = [
  { id: 'extend', Icon: Plus, label: 'starpass.manage.extend', step: 'overview' },
  { id: 'redeem', Icon: KeyRound, label: 'starpass.manage.redeem', step: 'redeem' },
  { id: 'gifts', Icon: Gift, label: 'starpass.gift.cta', step: 'gifts' },
  { id: 'invite', Icon: Users, label: 'starpass.invite.cta', step: 'invite' },
];

export const PassSummary = memo(function PassSummary() {
  const { t } = useTranslation();
  const username = useAuthStore((s) => s.user?.username);
  const sub = usePaySubscription().data;
  const status = useStarStatus();
  const tier = useOwnTenure()?.tier;
  const api = useFlowApi();
  const source = sub ? primarySource(sub.sources) : null;
  const endsAt = source?.ends_at ?? sub?.premium_until ?? 0;
  const days = daysUntil(endsAt);
  const color = toneOf(status);
  const text = useHeadline(status, endsAt);
  return (
    <aside
      data-ui="star-pass-summary"
      className="overflow-hidden rounded-[22px] border border-ink/[0.08] bg-surface"
      style={{ boxShadow: '0 30px 70px -40px rgb(var(--shade) / calc(1 * var(--shade-alpha)))' }}
    >
      <div className="flex items-center gap-3 px-5 pt-5">
        <StarBadge size="lg" tier={tier} />
        <span className="min-w-0 truncate text-[14px] font-bold text-ink-90">
          {username ? `@${username}` : t('starpass.guestHandle')}
        </span>
      </div>
      <div className="flex items-center gap-4 px-5 py-5">
        <div className="relative grid size-[124px] shrink-0 place-items-center">
          <svg viewBox="0 0 124 124" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle
              cx="62"
              cy="62"
              r={R}
              fill="none"
              stroke="rgb(var(--ink) / 0.08)"
              strokeWidth="8"
            />
            <circle
              cx="62"
              cy="62"
              r={R}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - Math.min(1, Math.max(0.03, days / 30)))}
              style={{ transition: 'stroke-dashoffset 0.9s var(--ease-apple)' }}
            />
          </svg>
          <span className="relative text-center">
            <span className="block text-[32px] font-extrabold leading-none tracking-tight tabular-nums text-ink">
              {days}
            </span>
            <span className="mt-1 block text-[11px] text-ink-45">
              {t('starpass.invite.daysUnit')}
            </span>
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
            <span className="text-[18px] font-extrabold leading-tight tracking-tight tabular-nums text-ink">
              {text.head}
            </span>
          </div>
          {text.sub && <div className="mt-1 text-[12px] tabular-nums text-ink-50">{text.sub}</div>}
          {source && status?.kind !== 'open' && (
            <div className="mt-2 text-[11.5px] text-ink-40">
              {t('starpass.manage.source')}: {t(`starpass.manage.sources.${source.category}`)}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-ink/[0.07] p-1.5">
        {ACTIONS.map(({ id, Icon, label, step }) => (
          <button
            key={id}
            type="button"
            data-star-act={id}
            onClick={() => (step === 'overview' ? api.extend() : api.setStep(step))}
            className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-[12px] px-3.5 text-left text-[13.5px] font-semibold text-ink-85 transition-colors hover:bg-ink/[0.06]"
          >
            <Icon size={16} className="text-accent" />
            <span className="flex-1">{t(label)}</span>
            <ChevronRight size={15} className="text-ink-30" />
          </button>
        ))}
      </div>
    </aside>
  );
});

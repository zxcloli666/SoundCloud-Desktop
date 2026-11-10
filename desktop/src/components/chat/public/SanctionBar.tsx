import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { shortDate } from '../../../lib/chat/time';
import { Ban, BookOpen } from '../../../lib/icons';
import { MicOff } from '../room/icons';
import { clockLeft, useCountdown } from './useCountdown';

const RING = 30;
const STROKE = 2.5;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Ring({ share }: { share: number }) {
  return (
    <svg width={RING} height={RING} className="absolute inset-0 -rotate-90" aria-hidden>
      <circle
        cx={RING / 2}
        cy={RING / 2}
        r={RADIUS}
        fill="none"
        className="stroke-rose-300/20"
        strokeWidth={STROKE}
      />
      <circle
        cx={RING / 2}
        cy={RING / 2}
        r={RADIUS}
        fill="none"
        className="stroke-rose-300"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - share)}
        style={{ transition: 'stroke-dashoffset 900ms linear' }}
      />
    </svg>
  );
}

function RulesButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate('/settings', { state: { category: 'chats' } })}
      className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-rose-300/25 px-3 text-[12px] font-semibold text-rose-100/90 transition-colors duration-150 hover:bg-rose-400/15"
    >
      <BookOpen size={13} />
      {t('chat.public.muted.rules')}
    </button>
  );
}

export const PublicMutedBar = memo(function PublicMutedBar({
  until,
  reason = null,
}: {
  until: number;
  reason?: string | null;
}) {
  const { t, i18n } = useTranslation();
  const left = useCountdown(until);
  const [total] = useState(() => Math.max(1, Math.ceil((until - Date.now()) / 1000)));
  const share = Math.max(0, Math.min(1, left / total));
  return (
    <div
      data-ui="chat-public-sanction"
      data-kind="muted"
      className="mx-3 mb-3 flex h-14 shrink-0 items-center gap-3 rounded-2xl border border-rose-300/15 bg-gradient-to-r from-rose-400/[0.12] to-transparent px-3.5"
    >
      <span className="relative flex size-[30px] shrink-0 items-center justify-center text-rose-200">
        <Ring share={share} />
        <MicOff size={13} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-rose-100/90">
          {t('chat.public.muted.title')}
        </span>
        <span
          data-ui="chat-public-mute-reason"
          title={reason ?? undefined}
          className={`block truncate text-[11.5px] ${reason ? 'text-rose-100/75' : 'text-rose-200/60'}`}
        >
          {reason ??
            t('chat.public.muted.until', { time: shortDate(until, Date.now(), i18n.language) })}
        </span>
      </span>
      <span className="shrink-0 text-[15px] font-bold tabular-nums text-rose-200/90">
        {clockLeft(left)}
      </span>
      <RulesButton />
    </div>
  );
});

export const PublicBannedBar = memo(function PublicBannedBar() {
  const { t } = useTranslation();
  return (
    <div
      data-ui="chat-public-sanction"
      data-kind="banned"
      className="mx-3 mb-3 flex h-14 shrink-0 items-center gap-3 rounded-2xl border border-rose-300/15 bg-gradient-to-r from-rose-500/[0.14] to-transparent px-3.5"
    >
      <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-200">
        <Ban size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-rose-100/90">
          {t('chat.public.banned.title')}
        </span>
        <span className="block truncate text-[11.5px] text-rose-200/60">
          {t('chat.public.banned.hint')}
        </span>
      </span>
      <RulesButton />
    </div>
  );
});

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, MessagesSquare } from '../../../lib/chat/icons';
import { usePerfMode } from '../../../lib/perf';
import { openNewChat } from '../new-chat/new-chat-store';

export const EmptyThread = memo(function EmptyThread() {
  const { t } = useTranslation();
  const perf = usePerfMode();
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      {perf.bloom && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--color-accent-glow) 0%, transparent 62%)',
            contain: 'strict',
          }}
        />
      )}
      <div className="relative flex items-end" style={{ isolation: 'isolate' }}>
        <span className="flex size-20 items-center justify-center rounded-[1.75rem] border border-ink/[0.08] bg-ink/[0.05] text-ink-55 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          <MessagesSquare size={30} strokeWidth={1.6} />
        </span>
        <span
          className="-ml-5 mb-[-10px] flex size-12 items-center justify-center rounded-2xl"
          style={{
            color: 'var(--color-accent-contrast)',
            background: 'linear-gradient(150deg, var(--color-accent-hover), var(--color-accent))',
            boxShadow: '0 12px 30px var(--color-accent-glow)',
          }}
        >
          <MessageCircle size={20} strokeWidth={2.2} />
        </span>
      </div>
      <p className="relative text-[14px] font-semibold text-ink-60">{t('chat.list.pick')}</p>
      <button
        type="button"
        onClick={openNewChat}
        className="relative cursor-pointer rounded-full px-5 py-2 text-[13px] font-bold transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]"
        style={{
          color: 'var(--color-accent-contrast)',
          background: 'linear-gradient(180deg, var(--color-accent-hover), var(--color-accent))',
          boxShadow: '0 10px 28px var(--color-accent-glow)',
        }}
      >
        {t('chat.list.newChat')}
      </button>
    </div>
  );
});

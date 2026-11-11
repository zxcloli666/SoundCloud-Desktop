import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Info, Keyboard, MessageCircle, X } from '../../../lib/icons';
import { undoById } from '../../../lib/voice/executor';
import type { HistoryRow as Row } from '../../../lib/voice/store';
import { useVoiceStore } from '../../../lib/voice/store';
import type { VoiceSource } from '../../../lib/voice/types';
import { Flag, Headset, Mic, RadioTower, SearchX, Undo2, WandSparkles } from '../icons';
import { intentIcon } from '../intentIcon';
import { clockTime } from '../time';
import { HistoryReply } from './HistoryReply';

function sourceIcon(source: VoiceSource): ReactNode {
  if (source === 'typed') return <Keyboard size={13} />;
  if (source === 'headset') return <Headset size={13} />;
  if (source === 'wake') return <WandSparkles size={13} />;
  if (source === 'remote') return <RadioTower size={13} />;
  return <Mic size={13} />;
}

function ResultMark({ result }: { result: Row['result'] }) {
  if (result === 'done') return <Check size={14} className="text-ok" strokeWidth={2.6} />;
  if (result === 'not_found') return <SearchX size={14} className="text-ink-40" />;
  if (result === 'asked') return <Info size={14} className="text-accent" />;
  if (result === 'replied') return <MessageCircle size={14} className="text-accent" />;
  return <X size={14} className="text-bad" strokeWidth={2.6} />;
}

export const HistoryRow = memo(function HistoryRow({
  row,
  undoable,
  lang,
}: {
  row: Row;
  undoable: boolean;
  lang: string;
}) {
  const { t } = useTranslation();
  const toggleWrong = useVoiceStore((s) => s.toggleWrong);
  return (
    <div data-ui="voice-history-row" className="group py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-ink/[0.06] bg-ink/[0.04] text-ink-50">
          {sourceIcon(row.source)}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-[13px] font-medium ${row.wrong ? 'text-ink-40 line-through decoration-bad/60' : 'text-ink-85'}`}
          >
            {t('voice.quote', { text: row.heard })}
          </p>
          {row.reply ? (
            <p className="mt-0.5 text-[11.5px] text-ink-30">{clockTime(row.at, lang)}</p>
          ) : (
            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-ink-45">
              <span className="flex shrink-0 items-center gap-0.5 text-ink-55">
                {row.intents.slice(0, 3).map((intent, i) => (
                  <span key={i}>{intentIcon(intent, 11)}</span>
                ))}
              </span>
              <span className="truncate">{row.label}</span>
              <span className="shrink-0 text-ink-30">· {clockTime(row.at, lang)}</span>
            </p>
          )}
        </div>
        <ResultMark result={row.result} />
        <span className="flex shrink-0 items-center gap-1">
          {undoable && (
            <button
              type="button"
              onClick={() => void undoById(row.id)}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-ink/[0.08] bg-ink/[0.05] px-2 text-[11.5px] font-semibold text-ink-75 transition-colors hover:bg-ink/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
            >
              <Undo2 size={11} />
              {t('voice.hud.undo')}
            </button>
          )}
          <button
            type="button"
            onClick={() => toggleWrong(row.id)}
            aria-pressed={row.wrong}
            aria-label={t('voice.history.wrong')}
            title={t('voice.history.wrong')}
            className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-[11.5px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
              row.wrong
                ? 'bg-bad/12 text-bad'
                : 'text-ink-35 opacity-0 hover:bg-ink/[0.07] hover:text-ink-70 group-hover:opacity-100 focus-visible:opacity-100'
            }`}
          >
            <Flag size={11} fill={row.wrong ? 'currentColor' : 'none'} />
            {row.wrong && t('voice.history.markedWrong')}
          </button>
        </span>
      </div>
      {row.reply && <HistoryReply reply={row.reply} />}
    </div>
  );
});

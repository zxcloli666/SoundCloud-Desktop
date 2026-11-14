import { useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { canUndo, onUndoChange } from '../../../lib/voice/executor';
import { toggleListening } from '../../../lib/voice/listen';
import { useVoiceStore } from '../../../lib/voice/store';
import { usePlayerStore } from '../../../stores/player';
import { Card } from '../../settings/primitives';
import { History, Mic } from '../icons';
import { Empty, SmallButton } from './Block';
import { HistoryRow } from './HistoryRow';

const SHOWN = 6;

function useUndoTick() {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const offUndo = onUndoChange(bump);
    const offPlayer = usePlayerStore.subscribe((s, p) => {
      if (
        s.currentTrack !== p.currentTrack ||
        s.volume !== p.volume ||
        s.shuffle !== p.shuffle ||
        s.repeat !== p.repeat ||
        s.isPlaying !== p.isPlaying ||
        s.queue !== p.queue
      ) {
        bump();
      }
    });
    return () => {
      offUndo();
      offPlayer();
    };
  }, []);
}

export function HistoryCard({ canTalk }: { canTalk: boolean }) {
  const { t, i18n } = useTranslation();
  const history = useVoiceStore((s) => s.history);
  const clear = useVoiceStore((s) => s.clearHistory);
  const [all, setAll] = useState(false);
  useUndoTick();
  const rows = all ? history : history.slice(0, SHOWN);

  return (
    <Card
      title={t('voice.history.title')}
      icon={<History size={17} />}
      action={
        history.length > 0 ? (
          <SmallButton onClick={clear}>{t('voice.history.clear')}</SmallButton>
        ) : undefined
      }
    >
      {history.length === 0 ? (
        <Empty
          icon={<History size={22} />}
          text={t('voice.history.empty')}
          action={
            canTalk ? (
              <SmallButton primary onClick={() => toggleListening('hud')}>
                <Mic size={13} />
                {t('voice.history.try')}
              </SmallButton>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="divide-y divide-ink/[0.05]">
            {rows.map((row) => (
              <HistoryRow
                key={row.id}
                row={row}
                undoable={row.undoable && canUndo(row.id)}
                lang={i18n.language}
              />
            ))}
          </div>
          {history.length > SHOWN && (
            <button
              type="button"
              onClick={() => setAll(!all)}
              className="mt-3 w-full cursor-pointer rounded-xl py-2 text-[12px] font-semibold text-ink-45 transition-colors hover:bg-ink/[0.05] hover:text-ink-75"
            >
              {all
                ? t('voice.history.less')
                : t('voice.history.more', { count: history.length - SHOWN })}
            </button>
          )}
        </>
      )}
    </Card>
  );
}

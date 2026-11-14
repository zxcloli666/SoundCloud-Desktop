import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NOTES_CAP } from '../../../lib/voice/chat/notes';
import { useVoiceStore } from '../../../lib/voice/store';
import { Card, Toggle } from '../../settings/primitives';
import { Brain, MessageCircleHeart, ShieldCheck } from '../icons';
import { Block, Pill, SmallButton } from './Block';
import { MemoryList } from './MemoryList';

const DISARM_MS = 4000;

function ForgetAll({ onForget }: { onForget: () => void }) {
  const { t } = useTranslation();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), DISARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  return armed ? (
    <SmallButton danger onClick={onForget}>
      {t('voice.chat.memoryClearYes')}
    </SmallButton>
  ) : (
    <SmallButton onClick={() => setArmed(true)}>{t('voice.chat.memoryClear')}</SmallButton>
  );
}

export function ChatCard() {
  const { t } = useTranslation();
  const on = useVoiceStore((s) => s.config.llm);
  const count = useVoiceStore((s) => s.notes.length);
  const patch = useVoiceStore((s) => s.patch);
  const setNotes = useVoiceStore((s) => s.setNotes);

  return (
    <Card title={t('voice.chat.title')} icon={<MessageCircleHeart size={17} />}>
      <div className="divide-y divide-ink/[0.05]">
        <Block
          data-ui="settings-row"
          icon={<ShieldCheck size={14} />}
          title={t('voice.chat.toggle')}
          desc={t('voice.chat.toggleDesc')}
          control={
            <Toggle
              checked={on}
              onChange={() => patch({ llm: !on })}
              label={t('voice.chat.toggle')}
            />
          }
        />
        <Block
          data-ui="settings-row"
          icon={<Brain size={14} />}
          title={t('voice.chat.memory')}
          control={
            <>
              <Pill tone={count >= NOTES_CAP ? 'warn' : count > 0 ? 'accent' : 'muted'}>
                <span className="font-mono tabular-nums">
                  {count}/{NOTES_CAP}
                </span>
              </Pill>
              {count > 0 && <ForgetAll onForget={() => setNotes([])} />}
            </>
          }
        >
          <MemoryList />
        </Block>
      </div>
    </Card>
  );
}

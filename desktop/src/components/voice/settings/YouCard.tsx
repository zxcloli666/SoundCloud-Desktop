import { useTranslation } from 'react-i18next';
import { voiceIpc } from '../../../lib/voice/ipc';
import { useVoiceRuntime } from '../../../lib/voice/runtime';
import { useVoiceStore } from '../../../lib/voice/store';
import { Card } from '../../settings/primitives';
import { Drama, Hand, MessageCircleHeart, UserRound, UsersRound } from '../icons';
import { AddressPicker } from './AddressPicker';
import { Block, Pill, SmallButton } from './Block';
import { RolePicker } from './RolePicker';

function SayHi() {
  const { t } = useTranslation();
  const busy = useVoiceRuntime((s) => s.engine === 'listening' || s.engine === 'thinking');
  return (
    <SmallButton
      disabled={busy}
      onClick={() => void voiceIpc.text(t('voice.you.hello'), 'typed').catch(() => {})}
    >
      <Hand size={13} />
      {t('voice.you.try')}
    </SmallButton>
  );
}

function ChatOff() {
  const { t } = useTranslation();
  return (
    <Pill tone="muted">
      <MessageCircleHeart size={11} />
      {t('voice.you.chatOff')}
    </Pill>
  );
}

function cardAction(on: boolean, canTalk: boolean) {
  if (!on) return <ChatOff />;
  return canTalk ? <SayHi /> : undefined;
}

export function YouCard({ canTalk }: { canTalk: boolean }) {
  const { t } = useTranslation();
  const on = useVoiceStore((s) => s.config.llm);

  return (
    <Card
      title={t('voice.you.title')}
      icon={<UsersRound size={17} />}
      action={cardAction(on, canTalk)}
    >
      <fieldset
        disabled={!on}
        className="min-w-0 divide-y divide-ink/[0.05] transition-opacity duration-500 disabled:opacity-40"
      >
        <Block data-ui="settings-row" icon={<UserRound size={14} />} title={t('voice.you.address')}>
          <AddressPicker />
        </Block>
        <Block data-ui="settings-row" icon={<Drama size={14} />} title={t('voice.you.role')}>
          <RolePicker />
        </Block>
      </fieldset>
    </Card>
  );
}

import { useTranslation } from 'react-i18next';
import { chatSettingsShown } from '../../../lib/chat/gate';
import { MessagesSquare } from '../../../lib/chat/icons';
import { RefreshCw } from '../../../lib/icons';
import { selectChatEnabled, useChatStore } from '../../../stores/chat';
import { Card } from '../../settings/primitives';
import { StorageEntry } from '../media/StorageEntry';
import { ChatGate } from '../shell/ChatGate';
import { BlockedCard } from './BlockedCard';
import { ChatNotifyCard } from './ChatNotifyCard';
import { DockHotkeyCard } from './DockHotkeyCard';
import { DevicesCard } from './devices/DevicesCard';
import { KeysCard } from './KeysCard';
import { RulesCard } from './RulesCard';
import { useChatSettings } from './useChatSettings';
import { VisibilityCard } from './VisibilityCard';
import { WhoCanWriteCard } from './WhoCanWriteCard';

function PrivacyCards() {
  const { t } = useTranslation();
  const { query, patch } = useChatSettings(true);

  if (query.isError) {
    return (
      <Card title={t('chat.settings.loadFailed')} icon={<MessagesSquare size={17} />}>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-ink/[0.06] bg-ink/[0.06] px-3.5 py-1.5 text-[12px] font-semibold text-ink-75 hover:bg-ink/[0.1]"
        >
          <RefreshCw size={12} />
          {t('chat.settings.retry')}
        </button>
      </Card>
    );
  }
  if (!query.data) return null;

  return (
    <>
      <WhoCanWriteCard settings={query.data} onPatch={patch} />
      <VisibilityCard settings={query.data} onPatch={patch} />
    </>
  );
}

function BlockedSection() {
  const { query, unblock } = useChatSettings(true);
  if (!query.data) return null;
  return <BlockedCard blocked={query.data.blocked} onUnblock={unblock} />;
}

export function ChatSettings() {
  const { t } = useTranslation();
  const enabled = useChatStore(selectChatEnabled);
  const phase = useChatStore((state) => state.status?.phase ?? null);
  const ready = phase === 'ready';

  if (!chatSettingsShown(enabled, phase)) {
    return (
      <Card
        title={t('chat.settings.title')}
        desc={t('chat.settings.unavailable')}
        icon={<MessagesSquare size={17} />}
      >
        {null}
      </Card>
    );
  }

  return (
    <>
      <ChatGate loading={null}>
        <PrivacyCards />
      </ChatGate>
      <ChatNotifyCard />
      <DockHotkeyCard />
      {ready && <DevicesCard />}
      {ready && <KeysCard />}
      {ready && <BlockedSection />}
      {ready && <StorageEntry />}
      <RulesCard />
    </>
  );
}

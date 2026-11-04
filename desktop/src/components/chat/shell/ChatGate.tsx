import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MessagesSquare, MonitorSmartphone } from '../../../lib/chat/icons';
import { selectChatEnabled, useChatStore } from '../../../stores/chat';
import { ListSkeleton } from '../list/ListEmpty';
import { KeychainCard } from '../relogin/KeychainCard';
import { ReloginCard } from '../relogin/ReloginCard';

function GateNote({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex size-14 items-center justify-center rounded-[1.25rem] border border-ink/[0.07] bg-ink/[0.04] text-ink-45">
        {icon}
      </div>
      <p className="max-w-[260px] text-[13px] font-medium text-ink-60">{text}</p>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-5 px-4 py-8">
      {children}
    </div>
  );
}

interface ChatGateProps {
  children: ReactNode;
  loading?: ReactNode;
}

export const ChatGate = memo(function ChatGate({
  children,
  loading = <ListSkeleton />,
}: ChatGateProps) {
  const { t } = useTranslation();
  const enabled = useChatStore(selectChatEnabled);
  const phase = useChatStore((state) => state.status?.phase ?? null);

  if (!enabled) {
    return (
      <Centered>
        <GateNote icon={<MessagesSquare size={22} />} text={t('chat.list.gate.off')} />
      </Centered>
    );
  }
  if (phase === 'unbound' || phase === 'bound_other') {
    return (
      <Centered>
        <ReloginCard reason={phase} />
      </Centered>
    );
  }
  if (phase === 'revoked') {
    return (
      <Centered>
        <GateNote icon={<MonitorSmartphone size={22} />} text={t('chat.list.gate.revoked')} />
        <ReloginCard reason="unbound" />
      </Centered>
    );
  }
  if (phase === 'keychain_denied') {
    return (
      <Centered>
        <KeychainCard />
      </Centered>
    );
  }
  if (phase !== 'ready') return loading;
  return children;
});

import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConversationSummary, ConvId } from '../../../lib/chat/types';
import { MessageCircle, Search } from '../../../lib/icons';
import { Skeleton } from '../../ui/Skeleton';
import { ShareTile } from './ShareTile';
import { targetAvatar } from './share-target';
import type { ShareTargets } from './useShareTargets';

const SKELETONS = 8;

interface ShareGridProps {
  targets: ShareTargets;
  selected: ConvId[];
  searching: boolean;
  titleOf: (conversation: ConversationSummary) => string;
  onToggle: (id: ConvId) => void;
}

function Note({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex h-[180px] flex-col items-center justify-center gap-2.5 text-ink-40">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink/[0.04]">
        {icon}
      </span>
      <span className="text-[12.5px]">{text}</span>
    </div>
  );
}

export const ShareGrid = memo(function ShareGrid({
  targets,
  selected,
  searching,
  titleOf,
  onToggle,
}: ShareGridProps) {
  const { t } = useTranslation();

  if (targets.loading) {
    return (
      <div className="grid grid-cols-4 gap-1 px-5 pb-3">
        {Array.from({ length: SKELETONS }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 py-2">
            <Skeleton className="h-[52px] w-[52px]" rounded="full" />
            <Skeleton className="h-2.5 w-12" rounded="sm" />
          </div>
        ))}
      </div>
    );
  }
  if (targets.failed)
    return <Note icon={<MessageCircle size={18} />} text={t('chat.embeds.share.loadFailed')} />;
  if (targets.items.length === 0) {
    return searching ? (
      <Note icon={<Search size={18} />} text={t('chat.embeds.share.noMatch')} />
    ) : (
      <Note icon={<MessageCircle size={18} />} text={t('chat.embeds.share.empty')} />
    );
  }

  return (
    <div className="grid max-h-[316px] grid-cols-4 gap-1 overflow-y-auto px-5 pb-3">
      {targets.items.map((conversation) => (
        <ShareTile
          key={conversation.id}
          id={conversation.id}
          kind={conversation.kind}
          title={titleOf(conversation)}
          avatarUrl={targetAvatar(conversation)}
          selected={selected.includes(conversation.id)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
});

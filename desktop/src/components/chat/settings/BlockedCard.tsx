import { useTranslation } from 'react-i18next';
import type { UserId, UserRef } from '../../../lib/chat/types';
import { Ban } from '../../../lib/icons';
import { Card } from '../../settings/primitives';
import { Avatar } from '../../ui/Avatar';
import { useOpenProfile } from '../profile';

interface BlockedCardProps {
  blocked: UserRef[];
  onUnblock: (userId: UserId) => void;
}

export function BlockedCard({ blocked, onUnblock }: BlockedCardProps) {
  const { t } = useTranslation();
  const openProfile = useOpenProfile();
  return (
    <Card title={t('chat.settings.blocked.title')} icon={<Ban size={17} />}>
      {blocked.length === 0 ? (
        <p className="text-[12.5px] text-ink-35">{t('chat.settings.blocked.empty')}</p>
      ) : (
        <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
          {blocked.map((user) => (
            <div key={user.id} className="flex items-center gap-3 rounded-2xl px-1 py-1.5">
              <button
                type="button"
                aria-label={t('chat.thread.actions.profile')}
                onClick={() => openProfile(user.id)}
                className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
              >
                <Avatar src={user.avatarUrl} alt={user.name} size={32} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-80 group-hover:text-ink">
                  {user.name}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onUnblock(user.id)}
                className="cursor-pointer rounded-xl border border-ink/[0.06] bg-ink/[0.05] px-3 py-1.5 text-[12px] font-semibold text-ink-70 transition-colors hover:bg-ink/[0.1] hover:text-ink"
              >
                {t('chat.settings.blocked.unblock')}
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

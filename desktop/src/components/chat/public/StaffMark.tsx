import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MemberRole } from '../../../lib/chat/types';
import { Crown, Shield } from '../../../lib/icons';

export const StaffMark = memo(function StaffMark({
  role,
  size = 13,
}: {
  role: MemberRole;
  size?: number;
}) {
  const { t } = useTranslation();
  if (role === 'owner') {
    return (
      <Crown
        size={size}
        aria-label={t('chat.public.roles.owner')}
        className="shrink-0 text-amber-300/90"
      />
    );
  }
  if (role === 'admin') {
    return (
      <Shield
        size={size}
        aria-label={t('chat.public.roles.moderator')}
        className="shrink-0 text-sky-300/90"
      />
    );
  }
  return null;
});

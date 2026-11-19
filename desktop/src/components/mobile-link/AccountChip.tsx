import { useTranslation } from 'react-i18next';
import type { LinkAccount } from '../../lib/mobile-link/api';
import { Avatar } from '../ui/Avatar';

export function AccountChip({ account }: { account: LinkAccount | null }) {
  const { t } = useTranslation();
  if (!account) {
    return (
      <div
        data-ui="mobile-link-account"
        aria-hidden
        className="h-[52px] w-full rounded-2xl bg-ink/[0.03] border border-ink/[0.06] motion-safe:animate-pulse"
      />
    );
  }
  return (
    <div
      data-ui="mobile-link-account"
      className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-2xl bg-ink/[0.03] border border-ink/[0.06]"
    >
      <Avatar src={account.avatarUrl} alt="" size={32} />
      <div className="min-w-0">
        <p className="text-[10.5px] uppercase tracking-wide text-ink-35 font-semibold">
          {t('mobileLink.account')}
        </p>
        <p className="text-[13.5px] font-semibold text-ink-85 truncate">{account.username}</p>
      </div>
    </div>
  );
}

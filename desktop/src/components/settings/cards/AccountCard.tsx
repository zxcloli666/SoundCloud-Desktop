import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Smartphone, User } from '../../../lib/icons';
import { useAppStatusStore } from '../../../stores/app-status';
import { useAuthStore } from '../../../stores/auth';
import { MobileAccessRow } from '../../mobile-link/MobileAccessRow';
import { SyncStatusRow } from '../../sync/SyncStatusRow';
import { Avatar } from '../../ui/Avatar';
import { Block, Card } from '../primitives';

const QrLinkSheetLazy = React.lazy(() =>
  import('../../auth/QrLinkSheet').then((m) => ({ default: m.QrLinkSheet })),
);

function Profile() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return (
    <Block className="flex items-center gap-3">
      <Avatar src={user.avatar_url} alt={user.username} size={40} />
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold text-ink-90">{user.username}</div>
        <div className="truncate text-[12px] text-ink-45">
          {user.permalink_url.replace(/^https?:\/\//, '')}
        </div>
      </div>
    </Block>
  );
}

export function AccountCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasSession = useAuthStore((s) => s.hasSession);
  const logout = useAuthStore((s) => s.logout);
  const [transferOpen, setTransferOpen] = useState(false);

  const goToSignIn = () => {
    useAppStatusStore.getState().setOfflineBypass(false);
    navigate('/', { replace: true });
  };

  if (!hasSession) {
    return (
      <Card
        title={t('settings.account')}
        icon={<User size={17} />}
        action={
          <button type="button" onClick={goToSignIn} className="set-btn" data-tone="accent">
            {t('settings.signIn')}
            <ChevronRight size={14} />
          </button>
        }
      />
    );
  }

  return (
    <Card title={t('settings.account')} icon={<User size={17} />}>
      <Profile />
      <SyncStatusRow />
      <MobileAccessRow />
      <Block className="flex flex-wrap items-center justify-between gap-2 py-3">
        <button type="button" onClick={() => setTransferOpen(true)} className="set-btn">
          <Smartphone size={14} />
          {t('qrLink.transferSession')}
        </button>
        <button type="button" onClick={logout} className="set-btn" data-tone="danger">
          {t('auth.signOut')}
        </button>
      </Block>
      {transferOpen && (
        <React.Suspense fallback={null}>
          <QrLinkSheetLazy open={transferOpen} onOpenChange={setTransferOpen} mode="push" />
        </React.Suspense>
      )}
    </Card>
  );
}

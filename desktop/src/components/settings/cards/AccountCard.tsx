import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone, User } from '../../../lib/icons';
import { useAuthStore } from '../../../stores/auth';
import { Card } from '../primitives';

const QrLinkSheetLazy = React.lazy(() =>
  import('../../auth/QrLinkSheet').then((m) => ({ default: m.QrLinkSheet })),
);

export function AccountCard() {
  const { t } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const [transferOpen, setTransferOpen] = useState(false);

  return (
    <Card title={t('settings.account')} icon={<User size={17} />}>
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => setTransferOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold bg-white/[0.04] text-white/75 hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 cursor-pointer w-fit"
        >
          <Smartphone size={14} />
          {t('qrLink.transferSession')}
        </button>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/10 hover:border-red-500/20 transition-all duration-300 cursor-pointer w-fit"
        >
          {t('auth.signOut')}
        </button>
      </div>
      {transferOpen && (
        <React.Suspense fallback={null}>
          <QrLinkSheetLazy open={transferOpen} onOpenChange={setTransferOpen} mode="push" />
        </React.Suspense>
      )}
    </Card>
  );
}

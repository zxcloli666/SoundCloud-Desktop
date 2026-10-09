import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Download } from '../../lib/icons';
import { getOfflineCollection } from '../../lib/offline-index';

export const OfflineCopyLink = React.memo(function OfflineCopyLink({ scope }: { scope: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    void getOfflineCollection(scope).then((collection) => {
      if (alive) setAvailable(collection !== null);
    });
    return () => {
      alive = false;
    };
  }, [scope]);

  if (!available) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/offline', { state: { collection: scope } })}
      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-accent px-5 text-[13px] font-semibold text-accent-contrast shadow-[0_10px_28px_-10px_var(--color-accent-glow),inset_0_1px_0_rgba(255,255,255,0.25)] transition-transform hover:scale-[1.03] active:scale-[0.97]"
    >
      <Download size={14} />
      {t('offline.openOfflineCopy')}
    </button>
  );
});

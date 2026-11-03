import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePlayingCopy } from '../../lib/alt-upload';
import { Replace } from '../../lib/icons';
import { useLyricsStore } from '../../stores/lyrics';

export const AltUploadMark = React.memo(function AltUploadMark({
  urn,
  size = 11,
}: {
  urn: string;
  size?: number;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const copy = usePlayingCopy(urn);
  if (!copy) return null;
  const label = t('player.altUpload', { name: copy.user?.username ?? '' });
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        useLyricsStore.getState().close();
        navigate(`/track/${encodeURIComponent(copy.urn)}`);
      }}
      className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full p-0.5 transition-colors duration-200 hover:bg-ink/[0.08]"
      style={{ color: 'var(--color-accent)' }}
    >
      <Replace size={size} />
    </button>
  );
});

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from '../../lib/icons';
import type { Track } from '../../stores/player';
import { SharingToggle } from '../music/SharingToggle';
import { DeleteTrackDialog } from './DeleteTrackDialog';
import { EditTrackDialog } from './EditTrackDialog';

const ICON_BUTTON =
  'inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer';

export const OwnerTrackActions = React.memo(function OwnerTrackActions({
  track,
}: {
  track: Track;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <span className="w-px h-5 bg-white/[0.08] mx-0.5" aria-hidden />
      <button
        type="button"
        onClick={() => setEditing(true)}
        title={t('track.edit')}
        aria-label={t('track.edit')}
        className={`${ICON_BUTTON} text-white/55 hover:text-white/95 hover:bg-white/[0.07]`}
      >
        <Pencil size={15} />
      </button>
      <SharingToggle kind="track" urn={track.urn} sharing={track.sharing} />
      <button
        type="button"
        onClick={() => setDeleting(true)}
        title={t('track.delete')}
        aria-label={t('track.delete')}
        className={`${ICON_BUTTON} text-white/45 hover:text-red-400 hover:bg-red-500/10`}
      >
        <Trash2 size={15} />
      </button>
      {editing && <EditTrackDialog track={track} open={editing} onOpenChange={setEditing} />}
      <DeleteTrackDialog
        track={track}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => navigate(-1)}
      />
    </>
  );
});

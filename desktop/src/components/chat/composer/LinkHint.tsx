import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { LinkIcon } from '../../../lib/icons';
import { linkBlockKey, type RoomLinkBlock } from '../../../lib/together/room-rules';

export const LinkHint = memo(function LinkHint({ block }: { block: Exclude<RoomLinkBlock, null> }) {
  const { t } = useTranslation();
  return (
    <div className="mx-1 mb-1.5 flex">
      <span
        role="status"
        className="flex h-7 items-center gap-1.5 rounded-full border border-rose-300/20 bg-rose-400/[0.1] px-3 text-[12px] font-semibold text-rose-200"
      >
        <LinkIcon size={12} className="shrink-0" />
        {t(linkBlockKey(block))}
      </span>
    </div>
  );
});

import { memo, useState } from 'react';
import type { UploadView } from '../../../../lib/chat/media-types';
import { chatMediaUrl } from '../../../../lib/chat/media-url';
import { ImageIcon, Users } from '../../../../lib/icons';

export const UploadThumb = memo(function UploadThumb({
  upload,
  size,
  radius = 10,
}: {
  upload: UploadView;
  size: number;
  radius?: number;
}) {
  const [broken, setBroken] = useState(false);
  const variant = upload.kind === 'image' ? 'upload-thumb' : 'upload-image';
  const style = { width: size, height: size, borderRadius: radius };
  if (broken) {
    const Glyph = upload.kind === 'avatar' ? Users : ImageIcon;
    return (
      <span
        className="flex shrink-0 items-center justify-center bg-ink/[0.07] text-ink-35"
        style={style}
      >
        <Glyph size={Math.round(size * 0.42)} />
      </span>
    );
  }
  return (
    <img
      src={chatMediaUrl(upload.conversationId, upload.id, variant)}
      alt=""
      draggable={false}
      decoding="async"
      onError={() => setBroken(true)}
      className="shrink-0 bg-ink/[0.06] object-cover"
      style={style}
    />
  );
});

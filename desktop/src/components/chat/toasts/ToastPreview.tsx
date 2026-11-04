import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Message, PreviewMode } from '../../../lib/chat/types';
import { art } from '../../../lib/formatters';
import { Music } from '../../../lib/icons';

export const ToastPreview = memo(function ToastPreview({
  message,
  mode,
}: {
  message: Message;
  mode: PreviewMode;
}) {
  const { t } = useTranslation();
  const body = message.body;

  if (body.type === 'system') {
    return (
      <p className="text-[12.5px] font-medium text-amber-200/90">
        {t(`chat.notify.system.${body.kind}`)}
      </p>
    );
  }
  if (mode !== 'full') {
    return <p className="text-[12.5px] text-ink-50">{t('chat.notify.newMessage')}</p>;
  }

  const embed = message.embeds[0];
  const text = body.type === 'text' ? body.text : '';
  return (
    <div className="flex min-w-0 items-center gap-2">
      {embed && (
        <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-ink/[0.06]">
          {embed.artworkUrl ? (
            <img
              src={art(embed.artworkUrl, 't67x67') ?? undefined}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <Music size={14} className="absolute inset-0 m-auto text-ink-40" />
          )}
        </span>
      )}
      <p className="selectable line-clamp-2 min-w-0 text-[12.5px] leading-snug break-words text-ink-70">
        {text || embed?.title}
      </p>
    </div>
  );
});

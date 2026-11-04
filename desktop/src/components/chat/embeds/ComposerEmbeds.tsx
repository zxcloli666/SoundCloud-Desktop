import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '../../../lib/icons';
import { Skeleton } from '../../ui/Skeleton';
import { EmbedCard } from './EmbedCard';
import type { PendingEmbed } from './useLinkEmbeds';

interface ComposerEmbedsProps {
  items: PendingEmbed[];
  onDismiss: (key: string) => void;
}

function Placeholder() {
  return (
    <div
      className="flex w-full max-w-[320px] items-center gap-3 rounded-[14px] p-2"
      style={{
        background: 'var(--color-bg-glass)',
        border: '0.5px solid var(--color-border-glass)',
      }}
    >
      <Skeleton className="h-10 w-10 shrink-0" rounded="md" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3 w-3/5" rounded="sm" />
        <Skeleton className="h-2.5 w-2/5" rounded="sm" />
      </div>
    </div>
  );
}

export const ComposerEmbeds = memo(function ComposerEmbeds({
  items,
  onDismiss,
}: ComposerEmbedsProps) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item) => (
        <div key={item.key} className="relative w-full max-w-[320px]">
          {item.embed ? <EmbedCard embed={item.embed} compact /> : <Placeholder />}
          <button
            type="button"
            aria-label={t('chat.embeds.remove')}
            title={t('chat.embeds.remove')}
            onClick={() => onDismiss(item.key)}
            data-scheme="dark"
            className="absolute right-1.5 top-1.5 z-[2] flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-ink-70 transition-colors duration-200 cursor-pointer hover:bg-black/75 hover:text-ink"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
});

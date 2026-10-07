import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '../../../lib/icons';

export const PlaylistNameInput = React.memo(function PlaylistNameInput({
  initial,
  onSubmit,
  onCancel,
  className = '',
}: {
  initial: string;
  onSubmit: (title: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const settled = useRef(false);
  const title = value.trim();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const finish = (next: string | null) => {
    if (settled.current) return;
    settled.current = true;
    if (next) onSubmit(next);
    else onCancel();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title) finish(title);
      }}
      className={`flex items-center gap-1.5 ${className}`}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') finish(null);
        }}
        onBlur={() => finish(title || null)}
        placeholder={t('local.playlistName')}
        aria-label={t('local.playlistName')}
        maxLength={80}
        className="h-8 min-w-0 flex-1 rounded-[9px] border border-white/[0.12] bg-white/[0.05] px-2.5 text-[12.5px] font-medium text-white/90 placeholder:text-white/30 focus:border-[var(--color-accent-glow)] focus:outline-none"
        ref={inputRef}
      />
      <button
        type="submit"
        onMouseDown={(e) => e.preventDefault()}
        disabled={!title}
        aria-label={t('local.save')}
        className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-[9px] bg-accent text-accent-contrast disabled:opacity-35"
      >
        <Check size={13} strokeWidth={2.4} />
      </button>
    </form>
  );
});

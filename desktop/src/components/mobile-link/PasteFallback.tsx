import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from '../../lib/icons';
import { QUIET_BUTTON } from './styles';

interface PasteFallbackProps {
  invalid: boolean;
  onApply: (text: string) => Promise<void>;
  onEdit: () => void;
}

export function PasteFallback({ invalid, onApply, onEdit }: PasteFallbackProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const panel = useId();

  const apply = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    await onApply(text);
    setBusy(false);
  };

  return (
    <div data-ui="mobile-link-paste" className="w-full">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11.5px] text-ink-35 hover:text-ink-65 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] rounded"
      >
        <ChevronRight
          size={12}
          className={`transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-90' : ''}`}
        />
        {t('mobileLink.paste.toggle')}
      </button>
      {open && (
        <form
          id={panel}
          className="mt-2 flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void apply();
          }}
        >
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                onEdit();
              }}
              aria-label={t('mobileLink.paste.toggle')}
              aria-invalid={invalid}
              placeholder="sc://auth?code=…&state=…"
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 px-3 py-2 rounded-xl text-[12px] font-mono bg-ink/[0.04] text-ink-80 placeholder:text-ink-25 border border-ink/[0.08] focus:border-[var(--color-accent)] focus:outline-none"
            />
            <button type="submit" disabled={!text.trim() || busy} className={QUIET_BUTTON}>
              {t('mobileLink.paste.apply')}
            </button>
          </div>
          {invalid && (
            <p role="alert" className="text-[11.5px] text-red-500">
              {t('mobileLink.paste.invalid')}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

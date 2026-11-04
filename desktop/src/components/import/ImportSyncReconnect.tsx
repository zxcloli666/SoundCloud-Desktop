import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function ImportSyncReconnect({ onSubmit }: { onSubmit: (token: string) => void }) {
  const { t } = useTranslation();
  const [token, setToken] = useState('');

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (token.trim()) onSubmit(token);
      }}
    >
      <input
        value={token}
        onChange={(event) => setToken(event.target.value)}
        placeholder={t('importer.tokenPlaceholder')}
        className="min-w-0 flex-1 rounded-lg border border-ink/[0.1] bg-ink/[0.05] px-2.5 py-1.5 text-[12px] text-ink-80 outline-none focus:border-accent/40"
      />
      <button
        type="submit"
        disabled={!token.trim()}
        className="rounded-lg border border-accent/20 bg-accent/20 px-3 py-1.5 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/30 cursor-pointer disabled:opacity-30 disabled:cursor-default"
      >
        {t('importer.connect')}
      </button>
    </form>
  );
}

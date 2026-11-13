import { openUrl } from '@tauri-apps/plugin-opener';
import { memo, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { siteUrl } from '../../../lib/site-url';

export function PageLink({ page, children }: { page: string; children?: ReactNode }) {
  const { i18n } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => void openUrl(siteUrl(page, i18n.language)).catch(() => {})}
      className="cursor-pointer text-ink-60 underline decoration-ink/25 underline-offset-2 transition-colors hover:text-ink-90"
    >
      {children}
    </button>
  );
}

export const LegalNote = memo(function LegalNote() {
  return (
    <p className="mt-3.5 text-[11.5px] leading-snug text-ink-40">
      <Trans
        i18nKey="starpass.legal"
        components={{ offer: <PageLink page="offer" />, refund: <PageLink page="refund" /> }}
      />
    </p>
  );
});

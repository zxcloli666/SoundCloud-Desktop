import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isValidPort } from '../../../../lib/obs/format';
import { Row } from '../../primitives';

export function PortField({ port, onChange }: { port: number; onChange: (port: number) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(String(port));
  const parsed = Number(draft);
  const valid = isValidPort(parsed);

  useEffect(() => setDraft(String(port)), [port]);

  const commit = () => {
    if (valid && parsed !== port) onChange(parsed);
    else if (!valid) setDraft(String(port));
  };

  return (
    <Row
      title={t('settings.obsPort')}
      desc={valid ? t('settings.obsPortDesc') : t('settings.obsPortInvalid')}
    >
      <input
        value={draft}
        inputMode="numeric"
        maxLength={5}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className={`w-24 rounded-xl border bg-white/[0.04] px-3 py-2 text-center font-mono text-[13px] text-white/85 outline-none transition-colors ${
          valid ? 'border-white/[0.08] focus:border-accent' : 'border-[#ff453a]/50'
        }`}
      />
    </Row>
  );
}

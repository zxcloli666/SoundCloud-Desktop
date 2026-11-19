import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from '../../../../lib/icons';
import { Btn } from './Btn';

export const CopyBtn = memo(function CopyBtn({
  text,
  label,
  tone = 'primary',
  size = 'md',
}: {
  text: string;
  label: string;
  tone?: 'primary' | 'ghost';
  size?: 'sm' | 'md';
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(id);
  }, [copied]);
  return (
    <Btn
      tone={tone}
      size={size}
      onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? t('starpass.gift.copied') : label}
    </Btn>
  );
});

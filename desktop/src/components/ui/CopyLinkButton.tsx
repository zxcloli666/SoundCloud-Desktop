import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, LinkIcon as Link } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { cleanPermalink } from '../../lib/permalink';

export function CopyLinkButton({
  url,
  size = 'md',
}: {
  url: string | undefined;
  size?: 'sm' | 'md';
}) {
  const { t } = useTranslation();
  const blur = usePerfMode().blur(20);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!url) return;
    navigator.clipboard.writeText(cleanPermalink(url));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [url]);

  if (!url) return null;

  const iconSize = size === 'sm' ? 13 : 15;
  const idleBg =
    blur > 0
      ? 'bg-ink/[0.04] hover:bg-ink/[0.08]'
      : 'bg-[rgb(var(--surface-hi)/0.85)] hover:bg-[rgb(var(--surface-hi)/0.9)]';

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 font-medium transition-all duration-300 ease-[var(--ease-apple)] cursor-pointer rounded-full border-[0.5px] ${
        copied
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          : `${idleBg} border-ink/[0.08] text-ink-50 hover:text-ink-80 hover:border-ink/[0.14]`
      } ${size === 'sm' ? 'px-3 py-1.5 text-[11px]' : 'h-11 px-5 text-[12px]'}`}
      style={{
        backdropFilter: blur > 0 ? `blur(${blur}px)` : undefined,
        WebkitBackdropFilter: blur > 0 ? `blur(${blur}px)` : undefined,
      }}
    >
      {copied ? <Check size={iconSize} className="text-emerald-400" /> : <Link size={iconSize} />}
      {copied ? t('auth.copied') : t('auth.copyLink')}
    </button>
  );
}

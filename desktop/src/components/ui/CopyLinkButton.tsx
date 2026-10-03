import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, LinkIcon as Link } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';

function cleanPermalink(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete('utm_medium');
    u.searchParams.delete('utm_campaign');
    u.searchParams.delete('utm_source');
    const clean = u.toString();
    return clean.endsWith('?') ? clean.slice(0, -1) : clean;
  } catch {
    return url;
  }
}

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
      ? 'bg-white/[0.04] hover:bg-white/[0.08]'
      : 'bg-[rgba(28,28,32,0.85)] hover:bg-[rgba(44,44,50,0.9)]';

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 font-medium transition-all duration-300 ease-[var(--ease-apple)] cursor-pointer rounded-full border-[0.5px] ${
        copied
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          : `${idleBg} border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/[0.14]`
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

import { openUrl } from '@tauri-apps/plugin-opener';
import { AlertCircle, ExternalLink, Sparkles, X } from '../lib/icons';
import { useMemo, useState } from 'react';
import { APP_VERSION } from '../lib/constants';
import type { GithubRelease } from '../lib/update-check';
import { useTranslation } from 'react-i18next';

function stripLeadingV(version: string) {
  return version.replace(/^v/, '');
}

function renderInlineMarkdown(text: string, keyPrefix: string) {
  const parts: React.ReactNode[] = [];
  const pattern = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let matchIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const [, imageAlt, imageUrl, linkLabel, linkUrl] = match;
    if (imageUrl) {
      parts.push(
        <img
          key={`${keyPrefix}-img-${matchIndex}`}
          src={imageUrl}
          alt={imageAlt || ''}
          loading="lazy"
          decoding="async"
          className="mt-2 rounded-lg border border-white/[0.08] max-w-full"
        />,
      );
    } else if (linkUrl) {
      parts.push(
        <button
          key={`${keyPrefix}-link-${matchIndex}`}
          type="button"
          onClick={() => openUrl(linkUrl)}
          className="inline text-accent hover:underline cursor-pointer"
        >
          {linkLabel}
        </button>,
      );
    }

    lastIndex = pattern.lastIndex;
    matchIndex += 1;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function calloutTone(kind: string) {
  switch (kind) {
    case 'WARNING':
    case 'CAUTION':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-100';
    case 'IMPORTANT':
      return 'border-accent/25 bg-accent/10 text-white/85';
    case 'TIP':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100';
    default:
      return 'border-sky-500/20 bg-sky-500/10 text-sky-100';
  }
}

function renderReleaseBody(body: string) {
  const lines = body.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      nodes.push(<div key={index} className="h-3" />);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      nodes.push(
        <h4 key={index} className="text-[13px] font-semibold text-white/80 mt-3 first:mt-0">
          {renderInlineMarkdown(trimmed.slice(4), `h4-${index}`)}
        </h4>,
      );
      continue;
    }
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      nodes.push(
        <h3 key={index} className="text-[14px] font-semibold text-white/85 mt-3 first:mt-0">
          {renderInlineMarkdown(trimmed.replace(/^#+\s*/, ''), `h3-${index}`)}
        </h3>,
      );
      continue;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      nodes.push(
        <p key={index} className="text-[12px] leading-relaxed text-white/60 pl-3">
          {'\u2022'} {renderInlineMarkdown(trimmed.slice(2), `li-${index}`)}
        </p>,
      );
      continue;
    }

    const calloutMatch = trimmed.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/);
    if (calloutMatch) {
      const [, kind, firstLine] = calloutMatch;
      const bodyLines: string[] = [];
      if (firstLine) bodyLines.push(firstLine);

      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1];
        if (!nextLine.trim().startsWith('>')) break;
        index += 1;
        bodyLines.push(nextLine.trim().replace(/^>\s?/, ''));
      }

      nodes.push(
        <div key={index} className={`rounded-xl border px-3 py-2.5 mt-2 ${calloutTone(kind)}`}>
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{kind}</p>
              <div className="mt-1 space-y-1 text-[12px] leading-relaxed opacity-90">
                {bodyLines.map((calloutLine, calloutIndex) => (
                  <p key={`${index}-${calloutIndex}`}>
                    {renderInlineMarkdown(calloutLine, `callout-${index}-${calloutIndex}`)}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>,
      );
      continue;
    }

    nodes.push(
      <p key={index} className="text-[12px] leading-relaxed text-white/60 whitespace-pre-wrap">
        {renderInlineMarkdown(trimmed, `p-${index}`)}
      </p>,
    );
  }

  return nodes;
}

export function UpdateChecker({ release }: { release: GithubRelease }) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const renderedNotes = useMemo(() => renderReleaseBody(release.body), [release.body]);

  if (!release || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 rounded-2xl bg-[#1a1a1e]/95 backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_64px_rgba(0,0,0,0.6)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent/15 flex items-center justify-center">
              <Sparkles size={16} className="text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">{t('update.available')}</h2>
              <p className="text-[11px] text-white/30 mt-0.5">
                {stripLeadingV(APP_VERSION)} → {stripLeadingV(release.tag_name)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={14} className="text-white/40" />
          </button>
        </div>

        {/* Release title */}
        {release.name && (
          <div className="px-5 pb-2">
            <p className="text-[13px] font-medium text-white/80">{release.name}</p>
          </div>
        )}

        {/* Release notes */}
        {release.body && (
          <div className="mx-5 mb-4 max-h-60 overflow-y-auto rounded-xl bg-black/30 border border-white/[0.08] p-4 space-y-1">
            {renderedNotes}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-[13px] text-white/50 font-medium transition-colors cursor-pointer"
          >
            {t('update.later')}
          </button>
          <button
            type="button"
            onClick={() => openUrl(release.html_url)}
            className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-[13px] text-accent-contrast font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_0_20px_var(--color-accent-glow)]"
          >
            {t('update.download')}
            <ExternalLink size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

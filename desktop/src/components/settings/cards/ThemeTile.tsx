import { memo, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { proxiedAssetUrl } from '../../../lib/asset-url';
import { THEMES_RAW_BASE } from '../../../lib/constants';
import { ArrowDownToLine, ArrowUp, Check, Loader2, Lock } from '../../../lib/icons';
import { type CatalogTheme, fileUrl } from '../../../lib/themes/index-parse.ts';
import { hasUpdate, type InstalledTheme, isBroken } from '../../../lib/themes/records';

export interface ThemeItem {
  id: string;
  entry: CatalogTheme | null;
  installed: InstalledTheme | null;
}

const ACTIVE_STYLE = {
  borderColor: 'var(--color-accent)',
  boxShadow: '0 0 0 1px var(--color-accent), 0 0 22px var(--color-accent-glow)',
};

export function themePreviewUrl(entry: CatalogTheme): string | null {
  return proxiedAssetUrl(fileUrl(THEMES_RAW_BASE, entry.rev, entry.id, entry.preview.path));
}

export function ThemeSwatch({
  accent,
  background,
  children,
}: {
  accent: string;
  background: string;
  children?: ReactNode;
}) {
  return (
    <div className="absolute inset-0" style={{ background }}>
      <div
        className="absolute inset-x-[12%] bottom-[14%] h-[18%] rounded-lg"
        style={{ background: 'rgb(var(--ink) / 0.06)' }}
      />
      <div
        className="absolute left-[12%] top-[16%] h-[22%] aspect-square rounded-full"
        style={{ background: accent, boxShadow: `0 0 18px ${accent}80` }}
      />
      {children}
    </div>
  );
}

function Badge({
  title,
  className,
  children,
}: {
  title: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      data-scheme="dark"
      className={`flex h-6 w-6 items-center justify-center rounded-full backdrop-blur-md ${className}`}
    >
      {children}
    </span>
  );
}

export const ThemeTile = memo(function ThemeTile({
  item,
  active,
  busy,
  onOpen,
}: {
  item: ThemeItem;
  active: boolean;
  busy: boolean;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const { entry, installed } = item;
  const name = entry?.name ?? installed?.name ?? item.id;
  const author = entry?.author.name;
  const preview = entry && !failed ? themePreviewUrl(entry) : null;
  const locked = !installed && !!entry && !entry.compatible;
  const broken = isBroken(installed);
  const update = !!installed && !!entry && hasUpdate(installed, entry);

  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border text-left transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
        active ? '' : 'border-ink/[0.06] hover:border-ink/15'
      } ${locked ? 'opacity-50' : ''}`}
      style={active ? ACTIVE_STYLE : undefined}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-ink/[0.03]">
        {preview ? (
          <img
            src={preview}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <ThemeSwatch
            accent={(installed ?? entry)?.accent ?? '#ffffff'}
            background={(installed ?? entry)?.background ?? '#0b0b0e'}
          />
        )}
        <div className="absolute right-2 top-2 flex gap-1">
          {broken && (
            <Badge title={t('settings.themesBroken')} className="bg-red-500/90 text-white">
              <span className="h-2 w-2 rounded-full bg-white" />
            </Badge>
          )}
          {update && (
            <Badge
              title={t('settings.themesHasUpdate')}
              className="bg-[var(--color-accent)] text-[var(--color-accent-contrast)]"
            >
              <ArrowUp size={13} strokeWidth={2.6} />
            </Badge>
          )}
          {locked && (
            <Badge
              title={t('settings.themesNeedsApp', { version: entry?.minApp })}
              className="bg-black/60 text-ink-80"
            >
              <Lock size={12} />
            </Badge>
          )}
          {installed && !active && !update && !broken && (
            <Badge title={t('settings.themesInstalled')} className="bg-black/50 text-ink-70">
              <ArrowDownToLine size={12} />
            </Badge>
          )}
          {active && (
            <Badge
              title={t('settings.themesActive')}
              className="bg-[var(--color-accent)] text-[var(--color-accent-contrast)]"
            >
              <Check size={13} strokeWidth={3} />
            </Badge>
          )}
        </div>
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <Loader2 size={20} className="animate-spin text-ink-80" />
          </div>
        )}
      </div>
      <div className="min-w-0 px-3 py-2 bg-ink/[0.03]">
        <div
          className={`truncate text-[12.5px] font-semibold ${active ? 'text-ink' : 'text-ink-75'}`}
        >
          {name}
        </div>
        {author && <div className="truncate text-[11px] text-ink-35">{author}</div>}
      </div>
    </button>
  );
});

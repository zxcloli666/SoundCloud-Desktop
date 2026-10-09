import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatBytes } from '../../../lib/formatters';
import { FileMusic, FolderOpen, FolderPlus, Plus, RefreshCw, X } from '../../../lib/icons';
import {
  forgetLocalFolder,
  pickLocalFiles,
  pickLocalFolder,
  rescanLocalLibrary,
} from '../../../lib/local-import';
import { usePerfMode } from '../../../lib/perf';
import { useLocalLibrary } from '../../../stores/local-library';
import { runLocalImport } from './importFeedback';
import { folderLabel } from './lib';

const ScanBar = React.memo(function ScanBar() {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const scanning = useLocalLibrary((s) => s.scanning);
  if (!scanning) return null;
  const pct = scanning.total > 0 ? Math.min(1, scanning.done / scanning.total) : 0;

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between font-mono text-[10.5px] tabular-nums text-white/45">
        <span>{t('local.scanning')}</span>
        {scanning.total > 0 && (
          <span>
            {scanning.done} / {scanning.total}
          </span>
        )}
      </div>
      <div className="relative h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
        <span
          className="absolute inset-y-0 left-0 w-full origin-left"
          style={{
            transform: `scaleX(${pct})`,
            background: 'linear-gradient(90deg, var(--color-accent-glow), var(--color-accent))',
            transition: 'transform 300ms var(--ease-apple)',
          }}
        />
        {perf.idleAnim && scanning.total === 0 && (
          <span
            className="off-anim absolute inset-y-0 left-[-30%] w-[30%]"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)',
              animation: 'off-rowsheen 1.4s linear infinite',
            }}
          />
        )}
      </div>
    </div>
  );
});

const FolderChip = React.memo(function FolderChip({ folder }: { folder: string }) {
  const { t } = useTranslation();
  return (
    <span
      title={folder}
      className="group/chip flex h-7 max-w-full items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] pl-2.5 pr-1 text-[11.5px] font-medium text-white/65"
    >
      <FolderOpen size={12} className="flex-none text-white/40" />
      <span className="truncate">{folderLabel(folder)}</span>
      <button
        type="button"
        onClick={() => forgetLocalFolder(folder)}
        title={t('local.removeFolder')}
        aria-label={t('local.removeFolder')}
        className="flex size-5 flex-none cursor-pointer items-center justify-center rounded-full text-white/35 transition-colors hover:bg-rose-400/15 hover:text-rose-200"
      >
        <X size={10} strokeWidth={2.4} />
      </button>
    </span>
  );
});

export const LocalImportPanel = React.memo(function LocalImportPanel({
  count,
  totalBytes,
}: {
  count: number;
  totalBytes: number;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const folders = useLocalLibrary((s) => s.folders);
  const busy = useLocalLibrary((s) => s.scanning !== null);
  const blur = perf.blur(24);

  return (
    <section
      className="relative grid overflow-hidden rounded-[20px] border border-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_60px_-32px_rgba(0,0,0,0.8)] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
      style={{
        background:
          blur > 0
            ? 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.018))'
            : 'rgb(17,17,21)',
        backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.25)` : undefined,
        WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.25)` : undefined,
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--color-accent-glow) 18%, transparent 42%)',
        }}
      />

      <div className="flex flex-col gap-3 p-5">
        <div
          className="relative flex items-center gap-4 overflow-hidden rounded-[16px] border border-dashed p-4"
          style={{
            borderColor: 'var(--color-accent-glow)',
            background:
              'radial-gradient(120% 140% at 0% 0%, var(--color-accent-glow), transparent 55%)',
          }}
        >
          <span
            className="flex size-12 flex-none items-center justify-center rounded-2xl"
            style={{
              background: 'var(--color-accent-glow)',
              color: 'var(--color-accent-hover)',
              boxShadow: perf.glow ? '0 10px 30px -10px var(--color-accent-glow)' : undefined,
            }}
          >
            <FileMusic size={22} />
          </span>
          <div className="min-w-0">
            <div className="text-[14.5px] font-semibold tracking-[-0.01em] text-white/92">
              {t('local.dropTitle')}
            </div>
            <div className="mt-0.5 text-[12px] leading-snug text-white/45">
              {t('local.dropHint')}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void runLocalImport(pickLocalFiles)}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-[11px] bg-accent px-4 text-[12.5px] font-semibold text-accent-contrast shadow-[0_6px_22px_-8px_var(--color-accent-glow),inset_0_1px_0_rgba(255,255,255,0.25)] transition-transform hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={14} strokeWidth={2.2} />
            {t('local.addFiles')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runLocalImport(pickLocalFolder)}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-[11px] border border-white/[0.08] bg-white/[0.03] px-4 text-[12.5px] font-semibold text-white/65 transition-colors hover:border-white/[0.14] hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FolderPlus size={14} />
            {t('local.addFolder')}
          </button>
        </div>
      </div>

      <div className="mx-5 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12)_30%,rgba(255,255,255,0.12)_70%,transparent)] lg:hidden" />

      <div className="flex min-w-0 flex-col p-5 lg:border-l lg:border-white/[0.07]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.2em] text-white/35">
              {t('local.onDisk')}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[26px] font-semibold tracking-[-0.03em] text-white/92 tabular-nums">
                {count}
              </span>
              <span className="text-[12px] text-white/45">
                {t('local.filesCount', { count })} · {formatBytes(totalBytes)}
              </span>
            </div>
          </div>
          {folders.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runLocalImport(rescanLocalLibrary)}
              title={t('local.rescanHint')}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] font-medium text-white/55 transition-colors hover:border-white/[0.14] hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCw size={12} className={busy ? 'animate-spin' : undefined} />
              {t('local.rescan')}
            </button>
          )}
        </div>

        {folders.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {folders.map((folder) => (
              <FolderChip key={folder} folder={folder} />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[12px] leading-snug text-white/35">{t('local.foldersHint')}</p>
        )}

        <ScanBar />
      </div>
    </section>
  );
});

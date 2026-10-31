import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { trackedInvoke as invoke } from '../../lib/diagnostics';
import type { EqFormat, EqImport } from '../../lib/equalizer';
import { Check, Copy, FileDown, FolderOpen, TriangleAlert, X } from '../../lib/icons';
import { useSettingsStore } from '../../stores/settings';

const fieldClass =
  'w-full resize-none rounded-lg border border-ink/[0.08] bg-ink/[0.03] px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-80 placeholder:text-ink-25 outline-none transition-colors focus:border-ink/[0.18] focus:bg-ink/[0.05]';

const iconButtonClass =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink/[0.06] bg-ink/[0.04] text-ink-40 transition-all cursor-pointer hover:text-ink-75 disabled:cursor-not-allowed disabled:opacity-40';

const chipClass = 'inline-flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-semibold';

function CloseButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      title={t('common.cancel')}
      aria-label={t('common.cancel')}
      className={iconButtonClass}
    >
      <X size={14} />
    </button>
  );
}

function ImportReport({ result }: { result: EqImport }) {
  const { t } = useTranslation();
  return (
    <>
      <span className={`${chipClass} bg-emerald-500/10 text-emerald-400`}>
        <Check size={11} />
        {t('eq.importUsed', { count: result.used })}
      </span>
      {result.deviation >= 0.5 && (
        <span
          title={t('eq.importDeviationHint')}
          className={`${chipClass} ${
            result.deviation >= 2
              ? 'bg-amber-500/10 text-amber-400'
              : 'bg-ink/[0.05] text-ink-50'
          }`}
        >
          {t('eq.importDeviation', { value: result.deviation.toFixed(1) })}
        </span>
      )}
      {result.skipped.length > 0 && (
        <span
          title={result.skipped.join('\n')}
          className={`${chipClass} bg-amber-500/10 text-amber-400`}
        >
          <TriangleAlert size={11} />
          {t('eq.importSkipped', { count: result.skipped.length })}
        </span>
      )}
    </>
  );
}

export const EqImportForm = React.memo(function EqImportForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [result, setResult] = useState<EqImport | null>(null);
  const [failure, setFailure] = useState<'empty' | 'unreadable' | null>(null);

  const run = useCallback((request: Promise<EqImport>) => {
    request
      .then((imported) => {
        const settings = useSettingsStore.getState();
        settings.setEqGains(imported.gains);
        settings.setEqPreamp(imported.preamp);
        setResult(imported);
        setFailure(null);
      })
      .catch((error) => {
        setResult(null);
        setFailure(error === 'no_filters' ? 'empty' : 'unreadable');
      });
  }, []);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (text.trim()) run(invoke<EqImport>('audio_eq_import', { text }));
    },
    [text, run],
  );

  const pickFile = useCallback(async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: t('eq.preset'), extensions: ['txt', 'peace'] }],
    }).catch(() => null);
    if (typeof path === 'string') run(invoke<EqImport>('audio_eq_import_file', { path }));
  }, [run, t]);

  return (
    <form onSubmit={submit} className="mt-2.5 space-y-2 animate-fade-in-up">
      <textarea
        autoFocus
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('eq.importPlaceholder')}
        aria-label={t('eq.import')}
        spellCheck={false}
        className={fieldClass}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => void pickFile()}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-ink/[0.06] bg-ink/[0.04] px-2.5 text-[11px] font-semibold text-ink-55 transition-all cursor-pointer hover:text-ink-80"
        >
          <FolderOpen size={13} />
          {t('eq.fromFile')}
        </button>
        {result && <ImportReport result={result} />}
        {failure && (
          <span className={`${chipClass} bg-red-500/10 text-red-400`}>
            <TriangleAlert size={11} />
            {t(failure === 'empty' ? 'eq.importFailed' : 'eq.readFailed')}
          </span>
        )}
        <span className="flex-1" />
        <button
          type="submit"
          disabled={!text.trim()}
          title={t('eq.apply')}
          aria-label={t('eq.apply')}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/15 text-emerald-400 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check size={14} />
        </button>
        <CloseButton onClick={onDone} />
      </div>
    </form>
  );
});

export const EqExportForm = React.memo(function EqExportForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const gains = useSettingsStore((s) => s.eqGains);
  const preamp = useSettingsStore((s) => s.eqPreamp);
  const [format, setFormat] = useState<EqFormat>('apo');
  const [text, setText] = useState('');
  const [done, setDone] = useState<'copy' | 'save' | null>(null);

  useEffect(() => {
    let alive = true;
    invoke<string>('audio_eq_export', { gains, preamp, format })
      .then((value) => {
        if (alive) setText(value);
      })
      .catch(console.error);
    return () => {
      alive = false;
    };
  }, [gains, preamp, format]);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(null), 2000);
    return () => clearTimeout(timer);
  }, [done]);

  const copy = useCallback(() => {
    navigator.clipboard
      .writeText(text)
      .then(() => setDone('copy'))
      .catch(console.error);
  }, [text]);

  const save = useCallback(async () => {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({
      defaultPath: format === 'apo' ? 'soundcloud-eq.txt' : 'soundcloud-graphiceq.txt',
      filters: [{ name: t('eq.preset'), extensions: ['txt'] }],
    }).catch(() => null);
    if (!path) return;
    invoke('audio_eq_save', { path, text })
      .then(() => setDone('save'))
      .catch(() => toast.error(t('eq.exportFailed')));
  }, [format, text, t]);

  return (
    <div className="mt-2.5 space-y-2 animate-fade-in-up">
      <textarea
        readOnly
        rows={4}
        value={text}
        aria-label={t('eq.export')}
        className={`${fieldClass} break-all`}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {(['apo', 'graphic'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFormat(value)}
            aria-pressed={format === value}
            className={`h-8 rounded-lg border px-2.5 text-[11px] font-semibold transition-all cursor-pointer ${
              format === value
                ? 'bg-ink/[0.1] text-ink-90 border-ink/[0.12]'
                : 'bg-ink/[0.02] text-ink-35 border-ink/[0.04] hover:bg-ink/[0.06] hover:text-ink-60'
            }`}
          >
            {t(value === 'apo' ? 'eq.formatApo' : 'eq.formatGraphic')}
          </button>
        ))}
        <span className="flex-1" />
        <button
          type="button"
          onClick={copy}
          disabled={!text}
          title={t('eq.copy')}
          aria-label={t('eq.copy')}
          className={iconButtonClass}
        >
          {done === 'copy' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!text}
          title={t('eq.saveFile')}
          aria-label={t('eq.saveFile')}
          className={iconButtonClass}
        >
          {done === 'save' ? (
            <Check size={14} className="text-emerald-400" />
          ) : (
            <FileDown size={14} />
          )}
        </button>
        <CloseButton onClick={onDone} />
      </div>
    </div>
  );
});

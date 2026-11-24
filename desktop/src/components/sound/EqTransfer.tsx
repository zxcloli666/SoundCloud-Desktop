import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { trackedInvoke as invoke } from '../../lib/diagnostics';
import type { EqFormat, EqImport } from '../../lib/equalizer';
import { Check, Copy, FileDown, FolderOpen, TriangleAlert, X } from '../../lib/icons';
import { useSettingsStore } from '../../stores/settings';
import { chip, FIELD, ICON_BTN, SUBMIT_BTN } from './styles';

const NOTE =
  'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[10.5px] font-semibold';
const BOX = `${FIELD} rounded-[12px] px-3 py-2`;
const TEXT =
  'block h-[36px] w-full resize-none bg-transparent font-mono text-[11px] leading-[18px] outline-none placeholder:text-ink-30';

function CloseButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      title={t('common.cancel')}
      aria-label={t('common.cancel')}
      className={ICON_BTN}
    >
      <X size={14} />
    </button>
  );
}

function ImportReport({ result }: { result: EqImport }) {
  const { t } = useTranslation();
  return (
    <>
      <span className={`${NOTE} bg-ok/10 text-ok`}>
        <Check size={11} />
        {t('eq.importUsed', { count: result.used })}
      </span>
      {result.deviation >= 0.5 && (
        <span
          title={t('eq.importDeviationHint')}
          className={`${NOTE} ${
            result.deviation >= 2 ? 'bg-amber-500/10 text-amber-400' : 'bg-ink/[0.05] text-ink-50'
          }`}
        >
          {t('eq.importDeviation', { value: result.deviation.toFixed(1) })}
        </span>
      )}
      {result.skipped.length > 0 && (
        <span
          title={result.skipped.join('\n')}
          className={`${NOTE} bg-amber-500/10 text-amber-400`}
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
        settings.setEqEnabled(true);
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
    <form onSubmit={submit} data-ui="sound-eq-transfer" className="flex shrink-0 flex-col gap-1.5">
      <div className={BOX}>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('eq.importPlaceholder')}
          aria-label={t('eq.import')}
          spellCheck={false}
          className={TEXT}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => void pickFile()} className={chip(false)}>
          <FolderOpen size={13} />
          {t('eq.fromFile')}
        </button>
        {result && <ImportReport result={result} />}
        {failure && (
          <span className={`${NOTE} bg-bad/10 text-bad`}>
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
          className={SUBMIT_BTN}
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
    <div data-ui="sound-eq-transfer" className="flex shrink-0 flex-col gap-1.5">
      <div className={BOX}>
        <textarea
          readOnly
          value={text}
          aria-label={t('eq.export')}
          className={`${TEXT} break-all`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {(['apo', 'graphic'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFormat(value)}
            aria-pressed={format === value}
            className={chip(format === value)}
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
          className={ICON_BTN}
        >
          {done === 'copy' ? <Check size={14} className="text-ok" /> : <Copy size={14} />}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!text}
          title={t('eq.saveFile')}
          aria-label={t('eq.saveFile')}
          className={ICON_BTN}
        >
          {done === 'save' ? <Check size={14} className="text-ok" /> : <FileDown size={14} />}
        </button>
        <CloseButton onClick={onDone} />
      </div>
    </div>
  );
});

import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { X } from '../../lib/icons';
import { useImportStore } from '../../stores/import';
import { Modal, ModalClose, ModalContent, ModalTitle } from '../ui/Modal';
import { ImportDestination } from './ImportDestination';
import { ImportDone } from './ImportDone';
import { ImportErrorCard } from './ImportErrorCard';
import { ImportForm } from './ImportForm';
import { ImportHistory } from './ImportHistory';
import { ImportProgressPanel } from './ImportProgressPanel';
import { ImportRows } from './ImportRows';
import { ImportSourceIcon } from './ImportSourceIcon';

const BUTTON =
  'px-5 py-2 rounded-xl text-[13px] font-semibold border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default';
const NEUTRAL = `${BUTTON} bg-ink/[0.05] hover:bg-ink/[0.09] text-ink-72 border-ink/[0.08]`;

export default function ImportDialog() {
  const { t } = useTranslation();
  const { phase, kind, title, failure, found, open, closeDialog, stopImport, saveImport, discard } =
    useImportStore(
      useShallow((s) => ({
        phase: s.phase,
        kind: s.kind,
        title: s.title,
        failure: s.failure,
        found: s.rows.filter((row) => row.urn).length,
        open: s.dialogOpen,
        closeDialog: s.closeDialog,
        stopImport: s.stopImport,
        saveImport: s.saveImport,
        discard: s.discard,
      })),
    );

  const form = phase === 'idle' || phase === 'error';
  const running = phase === 'running' || phase === 'stopping';
  const session = !form;

  return (
    <Modal open={open} onOpenChange={(value) => !value && closeDialog()}>
      <ModalContent size="lg" showClose={false} zClass="z-[80]">
        <div className="flex items-center gap-3 border-b border-ink/[0.06] px-7 pt-6 pb-4">
          {session && kind && (
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <ImportSourceIcon kind={kind} />
            </span>
          )}
          <ModalTitle className="min-w-0 flex-1 truncate text-[18px] font-bold tracking-tight text-ink-90">
            {session && title ? title : t('importer.title')}
          </ModalTitle>
          <ModalClose asChild>
            <button
              type="button"
              aria-label={t('common.close')}
              className="flex size-8 items-center justify-center rounded-lg text-ink-30 transition-all hover:bg-ink/[0.08] hover:text-ink-60 cursor-pointer"
            >
              <X size={16} />
            </button>
          </ModalClose>
        </div>

        <div className="space-y-5 px-7 py-5">
          {form && (
            <>
              {failure && <ImportErrorCard failure={failure} />}
              <ImportForm />
              <ImportHistory />
            </>
          )}
          {session && phase !== 'done' && (
            <>
              <ImportProgressPanel />
              {failure && <ImportErrorCard failure={failure} />}
              <ImportRows editable={phase === 'review'} />
              {phase === 'review' && <ImportDestination />}
            </>
          )}
          {phase === 'done' && (
            <>
              <ImportProgressPanel />
              <ImportDone />
            </>
          )}
        </div>

        {session && phase !== 'done' && (
          <div className="flex justify-end gap-3 border-t border-ink/[0.06] px-7 py-4">
            {running && (
              <>
                <button type="button" onClick={closeDialog} className={NEUTRAL}>
                  {t('importer.hide')}
                </button>
                <button
                  type="button"
                  onClick={() => void stopImport()}
                  disabled={phase === 'stopping'}
                  className={`${BUTTON} border-red-500/10 bg-red-500/10 text-red-400 hover:bg-red-500/20`}
                >
                  {t('importer.stop')}
                </button>
              </>
            )}
            {phase === 'review' && (
              <button type="button" onClick={discard} className={NEUTRAL}>
                {t('importer.discard')}
              </button>
            )}
            {phase === 'review' && (
              <button
                type="button"
                onClick={() => void saveImport()}
                disabled={found === 0}
                className={`${BUTTON} border-accent/20 bg-accent/20 text-accent hover:bg-accent/30`}
              >
                {t('importer.save', { count: found })}
              </button>
            )}
            {phase === 'saving' && (
              <button type="button" onClick={closeDialog} className={NEUTRAL}>
                {t('importer.hide')}
              </button>
            )}
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}

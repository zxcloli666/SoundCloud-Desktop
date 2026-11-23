import { useTranslation } from 'react-i18next';
import { ArrowRight, Download } from '../../../lib/icons';
import { useImportStore } from '../../../stores/import';
import { Card } from '../primitives';

export function ImportCard() {
  const { t } = useTranslation();
  const openDialog = useImportStore((s) => s.openDialog);

  return (
    <Card
      title={t('settings.import')}
      desc={t('importer.openButton')}
      icon={<Download size={17} />}
      action={
        <button type="button" onClick={() => openDialog()} className="set-btn">
          {t('importer.openView')}
          <ArrowRight size={13} />
        </button>
      }
    />
  );
}

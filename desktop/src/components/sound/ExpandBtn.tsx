import { useTranslation } from 'react-i18next';
import { Maximize2, Minimize2 } from '../../lib/icons';
import { ICON_BTN } from './styles';

export function ExpandBtn({ full, onClick }: { full: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  const label = full ? t('sound.collapse') : t('sound.expand');
  return (
    <button
      type="button"
      data-ui="sound-expand"
      aria-expanded={full}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={ICON_BTN}
    >
      {full ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
    </button>
  );
}

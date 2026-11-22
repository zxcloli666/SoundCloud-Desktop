import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AudioLines } from '../../../lib/icons';
import { useSearchPrefsStore } from '../../../stores/searchPrefs';

export function VibeButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const open = () => {
    useSearchPrefsStore.getState().setMode('vibe');
    navigate('/search');
    requestAnimationFrame(() => {
      document.getElementById('global-search-input')?.focus();
    });
  };
  return (
    <button
      type="button"
      data-ui="vibe-search"
      onClick={open}
      title={t('flowRedesign.vibeHint')}
      className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-ink/[0.08] bg-ink/[0.06] px-3 text-[11px] font-medium text-ink-70 transition-colors duration-200 hover:border-ink/[0.14] hover:bg-ink/[0.1] hover:text-ink-95"
    >
      <AudioLines size={12} aria-hidden />
      {t('flowRedesign.vibe')}
    </button>
  );
}

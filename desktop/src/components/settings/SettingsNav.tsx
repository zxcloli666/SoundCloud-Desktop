import { useTranslation } from 'react-i18next';
import type { SettingsCategory, SettingsCategoryId } from './registry';

export function SettingsNav({
  categories,
  active,
  onChange,
}: {
  categories: SettingsCategory[];
  active: SettingsCategoryId;
  onChange: (id: SettingsCategoryId) => void;
}) {
  const { t } = useTranslation();

  return (
    <nav className="sonveil-settings-nav" aria-label={t('settings.title')}>
      <div className="sonveil-settings-nav-list">
        {categories.map((category) => {
          const selected = category.id === active;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onChange(category.id)}
              className={selected ? 'is-active' : undefined}
              aria-current={selected ? 'page' : undefined}
            >
              <span>{category.icon}</span>
              {t(category.labelKey)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

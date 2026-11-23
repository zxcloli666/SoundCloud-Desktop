import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SettingsCategory, SettingsCategoryId } from './registry';

export function SettingsNav({
  categories,
  active,
  search,
  onChange,
}: {
  categories: SettingsCategory[];
  active: SettingsCategoryId | null;
  search: ReactNode;
  onChange: (id: SettingsCategoryId) => void;
}) {
  const { t } = useTranslation();
  return (
    <nav data-ui="settings-nav" className="set-rail">
      {search}
      <div className="set-rail-list">
        {categories.map((category, index) => {
          const on = category.id === active;
          const label = t(category.labelKey);
          return (
            <Fragment key={category.id}>
              {category.rare && !categories[index - 1]?.rare && (
                <span aria-hidden className="set-rail-gap" />
              )}
              <button
                type="button"
                data-ui="settings-nav-item"
                aria-current={on ? 'page' : undefined}
                aria-label={label}
                onClick={() => onChange(category.id)}
                className="set-nav-item"
              >
                <span className="set-nav-icon">{category.icon}</span>
                <span className="set-nav-label truncate">{label}</span>
              </button>
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
}

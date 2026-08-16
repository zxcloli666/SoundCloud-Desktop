import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SETTINGS_CATEGORIES, type SettingsCategoryId } from '../components/settings/registry';
import { SettingsFrame } from '../components/settings/SettingsFrame';
import { SettingsNav } from '../components/settings/SettingsNav';

export function Settings() {
  const { t } = useTranslation();
  const [active, setActive] = useState<SettingsCategoryId>('general');
  const category = SETTINGS_CATEGORIES.find((item) => item.id === active) ?? SETTINGS_CATEGORIES[0];
  const Body = category.Body;

  return (
    <SettingsFrame>
      <div className="sonveil-settings-layout">
        <SettingsNav categories={SETTINGS_CATEGORIES} active={active} onChange={setActive} />
        <div className="sonveil-settings-main">
          <header className="sonveil-settings-header">
            <span>{category.icon}</span>
            <div>
              <p>{t('settings.title')}</p>
              <h1>{t(category.labelKey)}</h1>
            </div>
          </header>
          <div key={active} className="sonveil-settings-body">
            <Body />
          </div>
        </div>
      </div>
    </SettingsFrame>
  );
}

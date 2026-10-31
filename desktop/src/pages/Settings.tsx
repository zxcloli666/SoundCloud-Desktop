import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {scrollMainToTop} from '../components/layout/ScrollReset';
import {SETTINGS_CATEGORIES, type SettingsCategoryId} from '../components/settings/registry';
import {SettingsFrame} from '../components/settings/SettingsFrame';
import {SettingsNav} from '../components/settings/SettingsNav';
import {useViewerAura} from '../lib/useViewerAura';

/** Settings — a star-lit two-pane workspace: a frosted category rail on the
 *  left, the active category's cards on the right. Thin shell; each section is
 *  its own small card under components/settings/. */
export function Settings() {
  const { t } = useTranslation();
    const aura = useViewerAura();
    const [active, setActive] = useState<SettingsCategoryId>('general');
    const selectCategory = (id: SettingsCategoryId) => {
        setActive(id);
        scrollMainToTop();
    };
    const category = SETTINGS_CATEGORIES.find((c) => c.id === active) ?? SETTINGS_CATEGORIES[0];
    const Body = category.Body;

  return (
      <SettingsFrame aura={aura}>
          <div data-ui="page" data-page="settings" className="max-w-[1080px] mx-auto px-6 md:px-8 pt-8 pb-32 flex gap-8">
              <SettingsNav categories={SETTINGS_CATEGORIES} active={active} onChange={selectCategory}/>
              <div className="flex-1 min-w-0">
                  <header className="mb-7 flex items-center gap-4">
                      <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-[var(--color-accent)]"
                          style={{
                              background:
                                  'linear-gradient(135deg, var(--color-accent-glow), rgb(var(--ink) / 0.05))',
                              border: '0.5px solid var(--color-accent-glow)',
                              boxShadow:
                                  '0 0 26px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.18)',
                          }}
                      >
                          {category.icon}
                      </div>
                      <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-ink-35 font-bold mb-1">
                              {t('settings.title')}
                          </p>
                          <h1
                              className="text-[30px] font-black tracking-tight leading-none"
                              style={{
                                  backgroundImage: aura.nameGradient,
                                  WebkitBackgroundClip: 'text',
                                  backgroundClip: 'text',
                                  color: 'transparent',
                              }}
                          >
                              {t(category.labelKey)}
                          </h1>
            </div>
                  </header>
                  <div key={active} className="space-y-5 animate-fade-in-up">
                      <Body/>
          </div>
              </div>
          </div>
      </SettingsFrame>
  );
}

import { useTranslation } from 'react-i18next';
import type { PreviewMode } from '../../../lib/chat/types';
import { Bell } from '../../../lib/icons';
import { Card, Divider, Row, Segmented, Toggle } from '../../settings/primitives';
import { useNotifyPrefs } from './useChatSettings';

const PREVIEWS: PreviewMode[] = ['full', 'name_only', 'hidden'];

export function ChatNotifyCard() {
  const { t } = useTranslation();
  const { prefs, set } = useNotifyPrefs();
  if (!prefs) return null;

  return (
    <Card
      title={t('chat.settings.notify.title')}
      icon={<Bell size={17} />}
      action={
        <Toggle
          checked={prefs.enabled}
          onChange={() => set({ ...prefs, enabled: !prefs.enabled })}
          label={t('chat.settings.notify.title')}
        />
      }
    >
      <div
        className={`transition-opacity duration-300 ${prefs.enabled ? '' : 'pointer-events-none opacity-45'}`}
      >
        <p className="mb-2 text-[12px] font-medium text-ink-55">
          {t('chat.settings.notify.preview')}
        </p>
        <Segmented
          value={prefs.preview}
          options={PREVIEWS.map((id) => ({ id, label: t(`chat.settings.notify.previews.${id}`) }))}
          onChange={(preview) => set({ ...prefs, preview })}
        />
        <div className="mt-4">
          <Row
            title={t('chat.settings.notify.streamMode')}
            desc={t('chat.settings.notify.streamHint')}
          >
            <Toggle
              checked={prefs.streamMode}
              onChange={() => set({ ...prefs, streamMode: !prefs.streamMode })}
              label={t('chat.settings.notify.streamMode')}
            />
          </Row>
          <Divider />
          <Row title={t('chat.settings.notify.sound')}>
            <Toggle
              checked={prefs.sound}
              onChange={() => set({ ...prefs, sound: !prefs.sound })}
              label={t('chat.settings.notify.sound')}
            />
          </Row>
        </div>
      </div>
    </Card>
  );
}

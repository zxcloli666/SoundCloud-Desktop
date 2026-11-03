import { useTranslation } from 'react-i18next';
import { CheckCheck } from '../../../lib/chat/icons';
import type { ChatSettings, SettingsPatch } from '../../../lib/chat/types';
import { Eye, Headphones, Keyboard } from '../../../lib/icons';
import { Card, Divider, Row, Toggle } from '../../settings/primitives';

interface VisibilityCardProps {
  settings: ChatSettings;
  onPatch: (patch: SettingsPatch) => void;
}

export function VisibilityCard({ settings, onPatch }: VisibilityCardProps) {
  const { t } = useTranslation();
  return (
    <Card title={t('chat.settings.visibility.title')} icon={<Eye size={17} />}>
      <Row
        title={
          <>
            <Headphones size={14} className="text-ink-40" />
            {t('chat.settings.visibility.presence')}
          </>
        }
        desc={<span className="block pl-[22px]">{t('chat.settings.visibility.presenceHint')}</span>}
      >
        <Toggle
          checked={settings.presenceShare}
          onChange={() => onPatch({ presenceShare: !settings.presenceShare })}
          label={t('chat.settings.visibility.presence')}
        />
      </Row>
      <Divider />
      <Row
        title={
          <>
            <CheckCheck size={14} className="text-ink-40" />
            {t('chat.settings.visibility.receipts')}
          </>
        }
      >
        <Toggle
          checked={settings.readReceipts}
          onChange={() => onPatch({ readReceipts: !settings.readReceipts })}
          label={t('chat.settings.visibility.receipts')}
        />
      </Row>
      <Divider />
      <Row
        title={
          <>
            <Keyboard size={14} className="text-ink-40" />
            {t('chat.settings.visibility.typing')}
          </>
        }
      >
        <Toggle
          checked={settings.typing}
          onChange={() => onPatch({ typing: !settings.typing })}
          label={t('chat.settings.visibility.typing')}
        />
      </Row>
    </Card>
  );
}

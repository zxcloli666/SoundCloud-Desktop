import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { Download, HardDrive } from '../../../lib/icons';
import { downloadMissing } from '../../../lib/voice/models';
import { summarize, useVoiceRuntime } from '../../../lib/voice/runtime';
import { Card } from '../../settings/primitives';
import { useFormatBytes } from '../format';
import { Empty, SmallButton } from './Block';
import { ModelRow } from './ModelRow';

export function ModelsCard() {
  const { t } = useTranslation();
  const bytes = useFormatBytes();
  const models = useVoiceRuntime((s) => s.models);
  const summary = useVoiceRuntime(useShallow((s) => summarize(s.models)));
  const onDisk = models.reduce((n, m) => n + (m.state === 'ready' ? m.total || m.size : m.done), 0);
  const missing = summary.required - summary.ready;

  return (
    <Card
      title={t('voice.models.title')}
      icon={<HardDrive size={17} />}
      action={
        <span className="flex items-center gap-2">
          <span className="font-mono text-[11.5px] tabular-nums text-ink-45">
            {t('voice.models.onDisk', { size: bytes(onDisk) })}
          </span>
          {missing > 0 && !summary.downloading && (
            <SmallButton primary onClick={downloadMissing}>
              <Download size={13} />
              {t('voice.models.getAll', { size: bytes(summary.missingBytes) })}
            </SmallButton>
          )}
        </span>
      }
    >
      {models.length === 0 ? (
        <Empty icon={<HardDrive size={22} />} text={t('voice.models.none')} />
      ) : (
        <div className="divide-y divide-ink/[0.05]">
          {models.map((model) => (
            <ModelRow key={model.id} model={model} />
          ))}
        </div>
      )}
    </Card>
  );
}

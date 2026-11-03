import { useTranslation } from 'react-i18next';
import { useSettingsStore, type YmImportOrder } from '../../stores/settings';

const ORDERS: { value: YmImportOrder; label: string }[] = [
  { value: 'newest', label: 'importer.orderNewest' },
  { value: 'oldest', label: 'importer.orderOldest' },
];

export function ImportOrderPicker({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  const order = useSettingsStore((s) => s.ymImportOrder);
  const setOrder = useSettingsStore((s) => s.setYmImportOrder);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-medium text-ink-60">{t('importer.orderLabel')}</p>
        <div
          role="radiogroup"
          aria-label={t('importer.orderLabel')}
          className="flex gap-0.5 rounded-[11px] border border-ink/[0.08] bg-ink/[0.02] p-[3px]"
        >
          {ORDERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={order === value}
              disabled={disabled}
              onClick={() => setOrder(value)}
              className={`rounded-lg px-3 py-[6px] text-[12px] font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                order === value
                  ? 'bg-ink/[0.08] text-ink-92 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                  : 'text-ink-50 hover:text-ink-80'
              }`}
            >
              {t(label)}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-ink-30">{t('importer.orderHint')}</p>
    </div>
  );
}

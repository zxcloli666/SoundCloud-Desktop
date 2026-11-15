import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Label, Panel } from '../ui/Panel';
import { MethodPanel } from './MethodPanel';
import { PerkChips } from './PerkChips';
import { TermPanel } from './TermPanel';
import { WhoPanel } from './WhoPanel';

export const ChooseView = memo(function ChooseView() {
  const { t } = useTranslation();
  return (
    <>
      <WhoPanel />
      <TermPanel />
      <MethodPanel />
      <Panel ui="star-perks-panel">
        <Label>{t('starpass.perksTitle')}</Label>
        <PerkChips />
      </Panel>
    </>
  );
});

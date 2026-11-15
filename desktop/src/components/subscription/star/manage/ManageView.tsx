import { memo } from 'react';
import { Panel } from '../ui/Panel';
import { Alerts } from './Alerts';
import { BindList } from './BindList';
import { Discord } from './Discord';
import { MemberCard } from './MemberCard';
import { RenewalRow } from './RenewalRow';
import { SeatsRow } from './SeatsRow';
import { Tenure } from './Tenure';
import { TrialRow } from './TrialRow';

export const ManageView = memo(function ManageView() {
  return (
    <>
      <Alerts />
      <MemberCard />
      <Panel ui="star-manage" pad={false} className="divide-y divide-ink/[0.07] overflow-hidden">
        <RenewalRow />
        <TrialRow />
        <BindList />
        <SeatsRow />
      </Panel>
      <Tenure />
      <Discord />
    </>
  );
});

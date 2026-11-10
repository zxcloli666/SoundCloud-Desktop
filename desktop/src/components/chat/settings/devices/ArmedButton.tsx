import { type ReactNode, useEffect, useState } from 'react';
import { DecisionButton } from '../../devices/DecisionButton';

const ARMED_MS = 4_000;

interface ArmedButtonProps {
  icon: ReactNode;
  label: string;
  armedLabel: string;
  busy?: boolean;
  disabled?: boolean;
  title?: string;
  onConfirm: () => void;
}

export function ArmedButton({
  icon,
  label,
  armedLabel,
  busy,
  disabled,
  title,
  onConfirm,
}: ArmedButtonProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), ARMED_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  const click = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    onConfirm();
  };

  return (
    <DecisionButton
      tone={armed ? 'no' : 'plain'}
      size="sm"
      icon={icon}
      busy={busy}
      disabled={disabled}
      title={title}
      onClick={click}
    >
      {armed ? armedLabel : label}
    </DecisionButton>
  );
}

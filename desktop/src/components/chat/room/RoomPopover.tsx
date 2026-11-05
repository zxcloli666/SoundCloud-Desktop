import * as Popover from '@radix-ui/react-popover';
import { createContext, type ReactNode, useCallback, useContext } from 'react';
import { surface } from '../../../lib/chat/tone';
import { usePerfMode } from '../../../lib/perf';

interface RoomPopoverProps {
  trigger: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width: number;
  children: ReactNode;
}

const CloseContext = createContext<() => void>(() => {});

export function useRoomPopoverClose(): () => void {
  return useContext(CloseContext);
}

export function RoomPopover({ trigger, open, onOpenChange, width, children }: RoomPopoverProps) {
  const blur = usePerfMode().blur(28);
  const closeParent = useContext(CloseContext);
  const close = useCallback(() => {
    onOpenChange(false);
    closeParent();
  }, [onOpenChange, closeParent]);
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="ctx-menu z-[300] flex flex-col overflow-y-auto overscroll-contain rounded-[16px] p-1.5 outline-none"
          style={{
            width,
            maxHeight: 'var(--radix-popover-content-available-height)',
            background: blur > 0 ? surface(7, 86) : surface(8),
            backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.8)` : undefined,
            WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.8)` : undefined,
            border: '1px solid var(--color-border-glass-hi)',
            boxShadow: '0 18px 50px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <CloseContext.Provider value={close}>{children}</CloseContext.Provider>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

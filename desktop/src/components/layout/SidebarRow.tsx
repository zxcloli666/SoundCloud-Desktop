import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { X } from '../../lib/icons';
import { IconBox, Label, ROW } from './SidebarChrome';

export function SidebarRow({
  to,
  title,
  icon,
  collapsed,
  actionLabel,
  onAction,
  actionIcon = <X size={13} strokeWidth={2.2} />,
}: {
  to: string;
  title: string;
  icon: ReactNode;
  collapsed: boolean;
  actionLabel: string;
  onAction: () => void;
  actionIcon?: ReactNode;
}) {
  return (
    <div className="group/pin relative">
      <NavLink
        to={to}
        title={collapsed ? title : undefined}
        className={({ isActive }) =>
          `${ROW} ${isActive ? '' : 'text-ink-50 hover:text-ink hover:bg-ink/[0.05]'}`
        }
      >
        <IconBox>{icon}</IconBox>
        <Label
          collapsed={collapsed}
          className="text-ellipsis text-[12.5px] font-medium pr-3 transition-[padding] group-hover/pin:pr-8"
        >
          {title}
        </Label>
      </NavLink>
      {!collapsed && (
        <button
          type="button"
          onClick={onAction}
          title={actionLabel}
          aria-label={actionLabel}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-ink-40 hover:text-ink hover:bg-ink/[0.1] opacity-0 group-hover/pin:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 cursor-pointer"
        >
          {actionIcon}
        </button>
      )}
    </div>
  );
}

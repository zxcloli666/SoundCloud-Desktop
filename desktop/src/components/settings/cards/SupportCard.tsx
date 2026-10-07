import { openUrl } from '@tauri-apps/plugin-opener';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BOOSTY_URL } from '../../../lib/constants';
import { ChevronRight, ExternalLink, Heart, Star } from '../../../lib/icons';
import { Card } from '../primitives';

function SupportOption({
  icon,
  title,
  desc,
  trailing,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  trailing: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/opt flex items-center gap-3.5 w-full text-left rounded-2xl px-4 py-3.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-[var(--color-accent-glow)] transition-all duration-300 ease-[var(--ease-apple)] active:scale-[0.985] cursor-pointer"
    >
      <span
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[var(--color-accent)] transition-transform duration-300 ease-[var(--ease-apple)] group-hover/opt:scale-110"
        style={{
          background: 'linear-gradient(135deg, var(--color-accent-glow), rgba(255,255,255,0.03))',
          border: '0.5px solid var(--color-accent-glow)',
        }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-white/85">{title}</span>
        <span className="block text-[11.5px] text-white/40 mt-0.5 leading-snug">{desc}</span>
      </span>
      <span className="shrink-0 text-white/30 group-hover/opt:text-[var(--color-accent)] transition-colors duration-300">
        {trailing}
      </span>
    </button>
  );
}

export function SupportCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card
      title={t('settings.support')}
      desc={t('settings.supportDesc')}
      icon={<Heart size={17} fill="currentColor" />}
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        <SupportOption
          icon={<Heart size={17} fill="currentColor" />}
          title={t('settings.supportDonate')}
          desc={t('settings.supportDonateDesc')}
          trailing={<ExternalLink size={14} />}
          onClick={() => openUrl(BOOSTY_URL)}
        />
        <SupportOption
          icon={<Star size={17} fill="currentColor" />}
          title={t('settings.supportStar')}
          desc={t('settings.supportStarDesc')}
          trailing={<ChevronRight size={16} />}
          onClick={() => navigate('/star')}
        />
      </div>
    </Card>
  );
}

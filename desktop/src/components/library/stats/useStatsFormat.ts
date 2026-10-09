import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { splitDuration } from './stats-utils';

export function useStatsFormat() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  return useMemo(() => {
    const numbers = new Intl.NumberFormat(locale);
    const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
    const month = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' });
    const monthShort = new Intl.DateTimeFormat(locale, { month: 'short' });
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const duration = (ms: number) => {
      const { hours, minutes } = splitDuration(ms);
      if (hours === 0) return t('stats.minutes', { count: minutes });
      if (hours >= 100 || minutes === 0) return t('stats.hours', { count: hours });
      return t('stats.hoursMinutes', { hours, minutes });
    };
    return {
      locale,
      number: (n: number) => numbers.format(n),
      duration,
      day: (d: Date) => day.format(d),
      month: (d: Date) => month.format(d),
      monthShort: (d: Date) => monthShort.format(d),
      weekday: (d: Date) => weekday.format(d),
    };
  }, [locale, t]);
}

import type { TaskFrequency } from '@prisma/client';

// All date math runs on the server in UTC. For HoReCa MVP we treat the date
// portion as the company's calendar day; production should anchor to a tz column.

type FreqConfig = {
  // weekly / fortnightly: 0 (Sun) … 6 (Sat)
  dayOfWeek?: number;
  // fortnightly: ISO date string for the *first* occurrence — we run every 14 days from there
  anchorDate?: string;
  // monthly: 1..31
  dayOfMonth?: number;
  // half_yearly: array of two months (1..12), e.g. [1, 7]
  months?: number[];
  // yearly: month (1..12) + day (1..31)
  month?: number;
  day?: number;
  // custom: list of ISO dates that are due
  dates?: string[];
};

export function isDueOn(
  frequency: TaskFrequency,
  config: FreqConfig | null | undefined,
  date: Date
): boolean {
  const cfg = config ?? {};
  const dow = date.getUTCDay();
  const dom = date.getUTCDate();
  const m = date.getUTCMonth() + 1;

  switch (frequency) {
    case 'daily':
      return true;

    case 'weekly':
      return cfg.dayOfWeek !== undefined ? dow === cfg.dayOfWeek : true;

    case 'fortnightly': {
      if (!cfg.anchorDate) return false;
      const anchor = new Date(cfg.anchorDate + 'T00:00:00Z');
      const diffDays = Math.floor((date.getTime() - anchor.getTime()) / 86_400_000);
      return diffDays >= 0 && diffDays % 14 === 0;
    }

    case 'monthly':
      return cfg.dayOfMonth !== undefined ? dom === cfg.dayOfMonth : false;

    case 'first_sunday':
      return dow === 0 && dom <= 7;

    case 'second_sunday':
      return dow === 0 && dom >= 8 && dom <= 14;

    case 'half_yearly': {
      const months = cfg.months ?? [1, 7];
      const dayMatch = cfg.dayOfMonth ? dom === cfg.dayOfMonth : dom === 1;
      return months.includes(m) && dayMatch;
    }

    case 'yearly': {
      const month = cfg.month ?? 1;
      const day = cfg.day ?? 1;
      return m === month && dom === day;
    }

    case 'custom':
      return (cfg.dates ?? []).includes(date.toISOString().slice(0, 10));
  }
}

export const frequencyLabel: Record<TaskFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  first_sunday: 'Every 1st Sunday',
  second_sunday: 'Every 2nd Sunday',
  half_yearly: 'Half-Yearly',
  yearly: 'Yearly',
  custom: 'Custom'
};

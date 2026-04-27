// Server-side date helpers. Day boundaries are UTC for the MVP; in prod each
// company should carry an IANA tz and these helpers should accept it.

export function todayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function startOfMonth(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function endOfMonth(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

export function combineDateAndTime(date: Date, hhmmss: string): Date {
  const [hh, mm, ss] = hhmmss.split(':').map((p) => parseInt(p, 10) || 0);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hh, mm, ss ?? 0)
  );
}

export function formatTime(hhmmss: string): string {
  const [hh, mm] = hhmmss.split(':');
  return `${hh}:${mm}`;
}

export function formatDateTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

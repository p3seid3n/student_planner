export const MIN = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

export function startOfDay(t: number | Date): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
export function addDays(t: number, n: number): number {
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  return d.getTime();
}
export function startOfWeek(t: number): number {
  const d = new Date(startOfDay(t));
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}
export function startOfMonth(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
export function addMonths(t: number, n: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth() + n, 1).getTime();
}
export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function sameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}
export function isWeekend(t: number): boolean {
  const g = new Date(t).getDay();
  return g === 0 || g === 6;
}
export function minutesOfDay(t: number): number {
  const d = new Date(t);
  return d.getHours() * 60 + d.getMinutes();
}

const LOCALE = 'de-CH';
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions, locale = 'en-GB') {
  const k = locale + JSON.stringify(opts);
  let f = fmtCache.get(k);
  if (!f) fmtCache.set(k, (f = new Intl.DateTimeFormat(locale, opts)));
  return f;
}
export const fTime = (t: number) => fmt({ hour: '2-digit', minute: '2-digit', hour12: false }, LOCALE).format(t);
export const fDate = (t: number) => fmt({ day: '2-digit', month: '2-digit', year: 'numeric' }, LOCALE).format(t);
export const fDayShort = (t: number) => fmt({ weekday: 'short' }).format(t);
export const fDayLong = (t: number) => fmt({ weekday: 'long' }).format(t);
export const fDayMonth = (t: number) => fmt({ day: 'numeric', month: 'short' }).format(t);
export const fFull = (t: number) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(t);
export const fMonthYear = (t: number) => fmt({ month: 'long', year: 'numeric' }).format(t);
export const fMonth = (t: number) => fmt({ month: 'short' }).format(t);

/** "Today", "Tomorrow", "Thu", "Mon 19 Oct" … */
export function relativeDay(t: number, now = Date.now()): string {
  const diff = Math.round((startOfDay(t) - startOfDay(now)) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return fDayLong(t);
  return `${fDayShort(t)} ${fDayMonth(t)}`;
}

export function daysUntil(t: number, now = Date.now()): number {
  return Math.round((startOfDay(t) - startOfDay(now)) / DAY);
}

export function durationLabel(ms: number): string {
  const m = Math.max(0, Math.round(ms / MIN));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function toInputDate(t: number): string {
  return dayKey(t);
}
export function toInputTime(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function fromInputs(date: string, time?: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0).getTime();
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Good night';
  if (h < 11) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Good night';
}

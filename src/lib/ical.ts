import ICAL from 'ical.js';
import { parseSummary } from './subjects';
import type { CalEvent, CalendarSource } from './types';

const DAY = 86_400_000;
/** Recurring events are expanded within this window around today. */
const PAST_WINDOW = 400 * DAY;
const FUTURE_WINDOW = 400 * DAY;
const MAX_OCCURRENCES = 2000;

function repair(text: string): string {
  // Some servers cut feeds off mid-event; keep everything up to the last complete VEVENT.
  if (/END:VCALENDAR\s*$/i.test(text.trim())) return text;
  const last = text.lastIndexOf('END:VEVENT');
  if (last === -1) return text;
  return text.slice(0, last + 'END:VEVENT'.length) + '\r\nEND:VCALENDAR\r\n';
}

export function calendarName(text: string): string | undefined {
  const m = text.match(/^X-WR-CALNAME:(.+)$/m) || text.match(/^NAME:(.+)$/m);
  return m?.[1]?.trim();
}

export function parseIcs(raw: string, source: Pick<CalendarSource, 'id' | 'kind'>): CalEvent[] {
  const text = repair(raw.replace(/^﻿/, ''));
  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(text));
  } catch (e) {
    throw new Error('This file could not be read as a calendar (.ics).');
  }

  for (const tz of root.getAllSubcomponents('vtimezone')) {
    try {
      const tzid = tz.getFirstPropertyValue('tzid');
      if (typeof tzid === 'string' && !ICAL.TimezoneService.has(tzid)) ICAL.TimezoneService.register(tz);
    } catch {
      /* ignore broken timezone blocks */
    }
  }

  const vevents = root.getAllSubcomponents('vevent');
  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const v of vevents) {
    const ev = new ICAL.Event(v);
    if (ev.isRecurrenceException()) exceptions.push(ev);
    else masters.set(ev.uid + '|' + (v.getFirstPropertyValue('dtstart')?.toString() ?? ''), ev);
  }
  const byUid = new Map<string, ICAL.Event>();
  for (const ev of masters.values()) if (ev.isRecurring()) byUid.set(ev.uid, ev);
  for (const ex of exceptions) byUid.get(ex.uid)?.relateException(ex);

  const now = Date.now();
  const from = now - PAST_WINDOW;
  const to = now + FUTURE_WINDOW;
  const out: CalEvent[] = [];
  const seen = new Set<string>();

  const push = (ev: ICAL.Event, startT: ICAL.Time, endT: ICAL.Time | null, item: ICAL.Event) => {
    const allDay = startT.isDate;
    let start = startT.toJSDate().getTime();
    let end = endT ? endT.toJSDate().getTime() : start + (allDay ? DAY : 3_600_000);
    if (allDay) {
      // keep all-day events anchored to local midnight
      start = new Date(startT.year, startT.month - 1, startT.day).getTime();
      const e = endT ?? startT;
      end = endT ? new Date(e.year, e.month - 1, e.day).getTime() : start + DAY;
      if (end <= start) end = start + DAY;
    }
    if (end < start) end = start;
    const title = (item.summary || ev.summary || 'Untitled').trim();
    const id = `${source.id}:${ev.uid}:${start}`;
    if (seen.has(id)) return;
    seen.add(id);
    const parsed = source.kind === 'school' || /^[A-Za-z]{1,5}-\d/.test(title) ? parseSummary(title) : textKind(title);
    out.push({
      id,
      sourceId: source.id,
      uid: ev.uid,
      title,
      start,
      end,
      allDay,
      location: item.location || undefined,
      description: item.description || undefined,
      ...parsed,
    });
  };

  for (const ev of masters.values()) {
    try {
      if (ev.isRecurring()) {
        const it = ev.iterator();
        let next: ICAL.Time | null;
        let n = 0;
        while ((next = it.next()) && n < MAX_OCCURRENCES) {
          const t = next.toJSDate().getTime();
          if (t > to) break;
          n++;
          if (t < from) continue;
          const d = ev.getOccurrenceDetails(next);
          push(ev, d.startDate, d.endDate, d.item);
        }
      } else {
        push(ev, ev.startDate, ev.endDate, ev);
      }
    } catch {
      /* skip malformed event */
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

function textKind(title: string): { kind: CalEvent['kind']; code?: string } {
  const p = parseSummary(title);
  return p.kind === 'test' ? p : { kind: 'event' };
}

/** Fetches a feed through our Vercel function (avoids CORS), falling back to a direct request. */
export async function fetchIcs(url: string): Promise<string> {
  const normalized = url.trim().replace(/^webcals?:\/\//i, 'https://');
  let proxyError: string | undefined;
  const res = await fetch(`/api/ical?url=${encodeURIComponent(normalized)}`, { cache: 'no-store' }).catch(() => null);
  if (res?.ok) {
    const text = await res.text();
    if (/BEGIN:VCALENDAR/i.test(text.slice(0, 4096))) return text;
    proxyError = 'That link did not return a calendar.';
  } else if (res && res.status !== 404) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || `Calendar sync failed (HTTP ${res.status})`);
  }
  const direct = await fetch(normalized, { cache: 'no-store' }).catch(() => null);
  if (direct?.ok) {
    const text = await direct.text();
    if (/BEGIN:VCALENDAR/i.test(text)) return text;
  }
  throw new Error(proxyError || 'Could not download the calendar. Check the link and your connection.');
}

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { eventTitle } from '../lib/titles';
import { useStore } from './store';
import { buildCodeIndex, eventSubjectId } from '../lib/subjects';
import { dayKey, DAY, startOfDay } from '../lib/dates';
import type { CalEvent, Subject, UpcomingItem } from '../lib/types';

export function useHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useStore.persist.onFinishHydration(cb),
    () => useStore.persist.hasHydrated(),
    () => false,
  );
}

/** A clock that re-renders every `ms` (aligned to the minute by default). */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(Date.now());
      t = setTimeout(tick, ms - (Date.now() % ms) + 20);
    };
    t = setTimeout(tick, ms - (Date.now() % ms) + 20);
    const vis = () => document.visibilityState === 'visible' && setNow(Date.now());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [ms]);
  return now;
}

export function useCodeIndex(): Map<string, string> {
  const subjects = useStore((s) => s.subjects);
  return useMemo(() => buildCodeIndex(subjects), [subjects]);
}

export function useSubjectList(includeHidden = false): Subject[] {
  const subjects = useStore((s) => s.subjects);
  return useMemo(
    () =>
      Object.values(subjects)
        .filter((s) => includeHidden || !s.hidden)
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name)),
    [subjects, includeHidden],
  );
}

export interface ResolvedEvent extends CalEvent {
  subject?: Subject;
}

/** Events with their subject resolved, minus anything hidden in calendar filters. */
export function useVisibleEvents(): ResolvedEvent[] {
  const events = useStore((s) => s.events);
  const subjects = useStore((s) => s.subjects);
  const sources = useStore((s) => s.sources);
  const hiddenSubjects = useStore((s) => s.settings.hiddenSubjects);
  const hiddenSources = useStore((s) => s.settings.hiddenSources);
  const codeIndex = useCodeIndex();
  return useMemo(() => {
    const hs = new Set(hiddenSubjects);
    const hsrc = new Set(hiddenSources);
    const disabled = new Set(sources.filter((s) => !s.enabled).map((s) => s.id));
    const out: ResolvedEvent[] = [];
    for (const e of events) {
      if (hsrc.has(e.sourceId) || disabled.has(e.sourceId)) continue;
      const sid = eventSubjectId(e, codeIndex);
      if (sid && hs.has(sid)) continue;
      const subject = sid ? subjects[sid] : undefined;
      if (subject?.hidden) continue;
      out.push(subject ? { ...e, subject } : e);
    }
    return out;
  }, [events, subjects, sources, hiddenSubjects, hiddenSources, codeIndex]);
}

export function useEventsByDay(): Map<string, ResolvedEvent[]> {
  const events = useVisibleEvents();
  return useMemo(() => {
    const map = new Map<string, ResolvedEvent[]>();
    for (const e of events) {
      // multi-day events appear on each day they cover
      let d = startOfDay(e.start);
      const last = e.allDay ? e.end - 1 : Math.max(e.start, e.end - 1);
      let guard = 0;
      while (d <= last && guard++ < 60) {
        const k = dayKey(d);
        let arr = map.get(k);
        if (!arr) map.set(k, (arr = []));
        arr.push(e);
        d = startOfDay(d + DAY + 3_600_000);
      }
    }
    return map;
  }, [events]);
}

/** Open tasks + test events from calendars, merged and sorted by due date. */
export function useUpcoming(daysAhead = 30, includeOverdue = true): UpcomingItem[] {
  const tasks = useStore((s) => s.tasks);
  const events = useVisibleEvents();
  const now = useNow(60_000);
  return useMemo(() => {
    const until = startOfDay(now) + (daysAhead + 1) * DAY;
    const linked = new Set(tasks.map((t) => t.eventId).filter(Boolean));
    const items: UpcomingItem[] = [];
    for (const t of tasks) {
      if (t.done) continue;
      if (t.due > until) continue;
      if (!includeOverdue && t.due < startOfDay(now)) continue;
      items.push({ id: t.id, kind: t.type === 'test' ? 'test' : 'task', title: t.title, subjectId: t.subjectId, due: t.due, hasTime: t.hasTime, task: t });
    }
    for (const e of events) {
      if (e.kind !== 'test' || linked.has(e.id)) continue;
      if (e.end < now || e.start > until) continue;
      items.push({ id: e.id, kind: 'test', title: eventTitle(e), subjectId: e.subject?.id, due: e.start, hasTime: !e.allDay, event: e });
    }
    return items.sort((a, b) => a.due - b.due);
  }, [tasks, events, now, daysAhead, includeOverdue]);
}

export function useMediaQuery(q: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(q);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => matchMedia(q).matches,
    () => false,
  );
}

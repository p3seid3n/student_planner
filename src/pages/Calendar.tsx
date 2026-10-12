import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { useStore } from '../store/store';
import { useEventsByDay, useMediaQuery, useNow, useSubjectList, type ResolvedEvent } from '../store/hooks';
import {
  addDays,
  addMonths,
  DAY,
  dayKey,
  fDayShort,
  fMonth,
  fMonthYear,
  fTime,
  HOUR,
  isWeekend,
  minutesOfDay,
  relativeDay,
  sameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from '../lib/dates';
import type { CalView, Subject, Task } from '../lib/types';
import { useEditors } from '../components/editors';
import { eventTitle, LessonRow } from '../components/items';
import { Check, Empty, Icon, Segmented, Sheet, SPRING, SubjectDot, Switch, useTones } from '../components/ui';
import { SUBJECT_COLORS } from '../lib/subjects';
import { tonesFor } from '../theme/theme';
import { useDark } from '../components/ui';

const VIEWS: { value: CalView; label: string; icon: string }[] = [
  { value: 'day', label: 'Day', icon: 'view_day' },
  { value: 'week', label: 'Week', icon: 'view_week' },
  { value: 'month', label: 'Month', icon: 'calendar_view_month' },
  { value: 'agenda', label: 'Agenda', icon: 'view_agenda' },
];

export default function CalendarPage() {
  const defaultView = useStore((s) => s.settings.defaultView);
  const narrow = useMediaQuery('(max-width: 839px)');
  const [view, setView] = useState<CalView>(() => (narrow && defaultView === 'week' ? 'day' : defaultView));
  const [anchor, setAnchor] = useState(() => startOfDay(Date.now()));
  const [dir, setDir] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const byDay = useEventsByDay();
  const weekendsSetting = useStore((s) => s.settings.weekends);
  const { openEvent } = useEditors.getState();

  const step = useCallback(
    (n: number) => {
      setDir(n);
      setAnchor((a) => {
        if (view === 'day') {
          let d = addDays(a, n);
          // skip empty weekends in day view
          if (weekendsSetting !== 'always') {
            for (let i = 0; i < 2 && isWeekend(d) && !(byDay.get(dayKey(d))?.length); i++) d = addDays(d, n);
          }
          return d;
        }
        if (view === 'week') return addDays(a, 7 * n);
        if (view === 'month') return addMonths(a, n);
        return addDays(a, 14 * n);
      });
    },
    [view, byDay, weekendsSetting],
  );
  const goToday = () => {
    setDir(anchor > Date.now() ? -1 : 1);
    setAnchor(startOfDay(Date.now()));
  };

  // keyboard shortcuts like Google Calendar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('.sheet')) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowright' || k === 'j' || k === 'n') step(1);
      else if (k === 'arrowleft' || k === 'k' || k === 'p') step(-1);
      else if (k === 't') goToday();
      else if (k === 'd' || k === '1') setView('day');
      else if (k === 'w' || k === '2') setView('week');
      else if (k === 'm' || k === '3') setView('month');
      else if (k === 'a' || k === '4') setView('agenda');
      else if (k === 'c') openEvent({});
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const days = useMemo(() => {
    if (view === 'day') return [anchor];
    const ws = startOfWeek(anchor);
    const all = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    if (weekendsSetting === 'always') return all;
    if (weekendsSetting === 'never') return all.slice(0, 5);
    const hasWeekend = all.slice(5).some((d) => (byDay.get(dayKey(d)) ?? []).length > 0);
    return hasWeekend ? all : all.slice(0, 5);
  }, [view, anchor, weekendsSetting, byDay]);

  const title = useMemo(() => {
    if (view === 'month') return narrow ? `${fMonth(anchor)} ${new Date(anchor).getFullYear()}` : fMonthYear(anchor);
    if (view === 'day') return narrow ? `${fDayShort(anchor)} ${new Date(anchor).getDate()}. ${fMonth(anchor)}` : relativeDay(anchor);
    if (view === 'agenda') return 'Agenda';
    const a = days[0];
    const b = days[days.length - 1];
    if (narrow) return `KW ${isoWeek(a)}`;
    return new Date(a).getMonth() === new Date(b).getMonth() ? fMonthYear(a) : `${fMonth(a)} – ${fMonthYear(b)}`;
  }, [view, anchor, days, narrow]);

  const weekNo = isoWeek(anchor);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 70 && Math.abs(info.offset.x) > Math.abs(info.offset.y)) step(info.offset.x < 0 ? 1 : -1);
  };
  const viewKey = `${view}-${view === 'month' ? startOfMonth(anchor) : view === 'week' ? startOfWeek(anchor) : anchor}`;

  return (
    <div className="cal-layout">
      {!narrow && (
        <aside className="cal-side">
          <MiniMonth value={anchor} onPick={(d) => (setDir(d > anchor ? 1 : -1), setAnchor(d))} byDay={byDay} />
          <SubjectFilters />
        </aside>
      )}
      <div className="cal-main">
        <div className="cal-toolbar">
          <div className="row" style={{ gap: 4, flex: 'none' }}>
            {narrow ? (
              <button className="icon-btn" aria-label="Today" onClick={goToday}>
                <Icon name="today" />
              </button>
            ) : (
              <button className="btn outlined sm" onClick={goToday}>
                Today
              </button>
            )}
            <button className="icon-btn" aria-label="Previous" onClick={() => step(-1)}>
              <Icon name="chevron_left" />
            </button>
            <button className="icon-btn" aria-label="Next" onClick={() => step(1)}>
              <Icon name="chevron_right" />
            </button>
          </div>
          <div className="grow" style={{ minWidth: 0 }}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={title} className={(narrow ? 'title-l' : 'headline-s') + ' ellipsis'} initial={{ opacity: 0, y: dir * 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: dir * -10 }} transition={SPRING}>
                {title}
                {view === 'week' && !narrow && <span className="body-m muted"> · KW {weekNo}</span>}
              </motion.div>
            </AnimatePresence>
          </div>
          {narrow ? (
            <>
              <select className="input view-select" value={view} onChange={(e) => setView(e.target.value as CalView)} aria-label="View">
                {VIEWS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
              <button className="icon-btn" aria-label="Subjects & colors" onClick={() => setFiltersOpen(true)}>
                <Icon name="palette" />
              </button>
            </>
          ) : (
            <Segmented layoutId="cal-view" value={view} onChange={setView} options={VIEWS.map(({ value, label }) => ({ value, label }))} />
          )}
        </div>

        <div className="cal-stage">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={viewKey}
              className="cal-view"
              custom={dir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: d * 48 }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: d * -48 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: SPRING, opacity: { duration: 0.18 } }}
              drag={narrow && view !== 'agenda' ? 'x' : false}
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.25}
              onDragEnd={onDragEnd}
            >
              {view === 'month' ? (
                <MonthGrid anchor={anchor} byDay={byDay} onPickDay={(d) => (setAnchor(d), setView('day'))} />
              ) : view === 'agenda' ? (
                <Agenda from={anchor} byDay={byDay} />
              ) : (
                <TimeGrid days={days} byDay={byDay} onPickDay={(d) => (setAnchor(d), setView('day'))} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} label="Subjects & colors">
        <div className="headline-s" style={{ marginBottom: 12 }}>
          Subjects & colors
        </div>
        <SubjectFilters />
      </Sheet>
    </div>
  );
}

function isoWeek(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - w1.getTime()) / DAY - 3 + ((w1.getDay() + 6) % 7)) / 7);
}

/* =========================================================
   Time grid (day / week)
   ========================================================= */
interface Placed {
  e: ResolvedEvent;
  col: number;
  cols: number;
}

function layoutDay(events: ResolvedEvent[]): Placed[] {
  const timed = events.filter((e) => !e.allDay).sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.col + 1));
    for (const p of cluster) p.cols = cols;
    out.push(...cluster);
    cluster = [];
  };
  for (const e of timed) {
    if (cluster.length && e.start >= clusterEnd) flush();
    const used = new Set(cluster.filter((p) => p.e.end > e.start).map((p) => p.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ e, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, e.end);
  }
  if (cluster.length) flush();
  return out;
}

function TimeGrid({ days, byDay, onPickDay }: { days: number[]; byDay: Map<string, ResolvedEvent[]>; onPickDay: (d: number) => void }) {
  const now = useNow(30_000);
  const tasks = useStore((s) => s.tasks);
  const narrow = useMediaQuery('(max-width: 839px)');
  const hourH = narrow ? 60 : 58;
  const scrollRef = useRef<HTMLDivElement>(null);
  const { openDetails, openEvent, openTask } = useEditors.getState();

  const dayEvents = days.map((d) => byDay.get(dayKey(d)) ?? []);
  const [minH, maxH] = useMemo(() => {
    let lo = 7;
    let hi = 18;
    for (const evs of dayEvents)
      for (const e of evs) {
        if (e.allDay) continue;
        lo = Math.min(lo, Math.floor(minutesOfDay(Math.max(e.start, startOfDay(e.start))) / 60));
        const endMin = sameDay(e.start, e.end - 1) ? minutesOfDay(e.end) : 24 * 60;
        hi = Math.max(hi, Math.ceil(endMin / 60));
      }
    return [Math.max(0, lo), Math.min(24, Math.max(hi, lo + 4))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join(), byDay]);

  const dayTasks = days.map((d) => tasks.filter((t) => sameDay(t.due, d)));
  const allDay = dayEvents.map((evs) => evs.filter((e) => e.allDay));
  const hasAllDayRow = allDay.some((a) => a.length) || dayTasks.some((t) => t.length);
  const hours = Array.from({ length: maxH - minH }, (_, i) => minH + i);
  const cols = `52px repeat(${days.length}, minmax(0, 1fr))`;

  const createAt = (day: number, ev: React.MouseEvent<HTMLDivElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const mins = minH * 60 + ((ev.clientY - rect.top) / hourH) * 60;
    const snapped = Math.floor(mins / 15) * 15;
    const start = startOfDay(day) + snapped * 60_000;
    openEvent({ start, end: start + 45 * 60_000 });
  };

  return (
    <div className="tg" style={{ ['--hour-h' as string]: hourH + 'px' } as CSSProperties}>
      <div className="tg-head" style={{ gridTemplateColumns: cols }}>
        <div />
        {days.map((d) => {
          const today = sameDay(d, now);
          return (
            <button key={d} className={'tg-day' + (today ? ' today' : '')} onClick={() => days.length > 1 && onPickDay(d)}>
              <span className="label-m upper">{fDayShort(d)}</span>
              <span className="tg-date tnum">{new Date(d).getDate()}</span>
            </button>
          );
        })}
      </div>
      {hasAllDayRow && (
        <div className="tg-allday" style={{ gridTemplateColumns: cols }}>
          <div className="label-s muted" style={{ textAlign: 'right', paddingRight: 8, paddingTop: 6 }}>
            ALL DAY
          </div>
          {days.map((d, i) => (
            <div key={d} className="tg-allday-cell">
              {allDay[i].map((e) => (
                <AllDayChip key={e.id} e={e} onClick={() => openDetails(e.id)} />
              ))}
              {dayTasks[i].map((t) => (
                <TaskChip key={t.id} t={t} onClick={() => openTask(t)} />
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="tg-body" ref={scrollRef} style={{ gridTemplateColumns: cols, height: (maxH - minH) * hourH }}>
        <div className="tg-hours">
          {hours.map((h) => (
            <div key={h} className="tg-hour label-s muted tnum" style={{ top: (h - minH) * hourH }}>
              {h > minH ? `${String(h).padStart(2, '0')}:00` : ''}
            </div>
          ))}
        </div>
        {days.map((d, i) => {
          const placed = layoutDay(dayEvents[i]);
          const today = sameDay(d, now);
          const nowTop = ((minutesOfDay(now) - minH * 60) / 60) * hourH;
          return (
            <div key={d} className={'tg-col' + (today ? ' today' : '') + (isWeekend(d) ? ' weekend' : '')} onDoubleClick={(ev) => createAt(d, ev)} onClick={(ev) => ev.target === ev.currentTarget && narrow && createAt(d, ev)}>
              {placed.map((p) => (
                <EventBlock key={p.e.id} p={p} day={d} minH={minH} hourH={hourH} now={now} compact={days.length > 1 && narrow} onClick={() => openDetails(p.e.id)} />
              ))}
              {today && nowTop >= 0 && nowTop <= (maxH - minH) * hourH && (
                <div className="tg-now" style={{ top: nowTop }}>
                  <span />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!narrow && <div className="body-s muted" style={{ padding: '10px 4px 0' }}>Double-click a slot to create an event · <span className="kbd">←</span> <span className="kbd">→</span> to navigate · <span className="kbd">D</span> <span className="kbd">W</span> <span className="kbd">M</span> <span className="kbd">A</span> views</div>}
    </div>
  );
}

function EventBlock({ p, day, minH, hourH, now, compact, onClick }: { p: Placed; day: number; minH: number; hourH: number; now: number; compact: boolean; onClick: () => void }) {
  const { e } = p;
  const tones = useTones(e.subject?.color ?? e.color ?? '#7a7a7a');
  const dayStart = startOfDay(day);
  const s = Math.max(e.start, dayStart);
  const en = Math.min(e.end, dayStart + DAY);
  const top = ((s - dayStart) / HOUR - minH) * hourH;
  const height = Math.max(20, ((en - s) / HOUR) * hourH - 2);
  const past = e.end < now;
  const live = now >= e.start && now < e.end;
  const isTest = e.kind === 'test';
  const short = height < 44;
  const style: CSSProperties = {
    top,
    height,
    left: `calc(${(p.col / p.cols) * 100}% + 2px)`,
    width: `calc(${100 / p.cols}% - 4px)`,
    background: isTest
      ? `repeating-linear-gradient(135deg, ${tones.container} 0 10px, color-mix(in srgb, ${tones.container} 80%, ${tones.accent}) 10px 20px)`
      : tones.container,
    color: tones.onContainer,
    ['--accent' as string]: tones.accent,
    opacity: past ? 0.62 : 1,
    boxShadow: live ? `0 0 0 2px ${tones.accent}, 0 8px 18px -8px ${tones.accent}` : undefined,
  };
  const name = compact && e.subject ? e.subject.short || e.subject.name : eventTitle(e);
  return (
    <motion.button
      className={'ev' + (short ? ' short' : '')}
      style={style}
      onClick={(ev) => {
        ev.stopPropagation();
        onClick();
      }}
      onDoubleClick={(ev) => ev.stopPropagation()}
      whileHover={{ scale: 1.02, zIndex: 3 }}
      whileTap={{ scale: 0.97 }}
      transition={SPRING}
      title={`${eventTitle(e)} ${fTime(e.start)}–${fTime(e.end)}${e.location ? ' · ' + e.location : ''}`}
    >
      <span className="ev-title">
        {isTest && <Icon name="quiz" size={14} style={{ marginRight: 3, verticalAlign: -2 }} />}
        {name}
      </span>
      {short ? (
        !compact && e.location && <span className="ev-meta"> · {e.location}</span>
      ) : (
        <span className="ev-meta">
          {compact ? e.location : `${fTime(e.start)}–${fTime(e.end)}${e.location ? ' · ' + e.location : ''}`}
        </span>
      )}
    </motion.button>
  );
}

function AllDayChip({ e, onClick }: { e: ResolvedEvent; onClick: () => void }) {
  const tones = useTones(e.subject?.color ?? e.color ?? '#7a7a7a');
  return (
    <button className="ad-chip" style={{ background: tones.accent, color: tones.onAccent }} onClick={onClick}>
      {e.kind === 'test' && <Icon name="quiz" size={14} />}
      <span className="ellipsis">{eventTitle(e)}</span>
    </button>
  );
}

function TaskChip({ t, onClick }: { t: Task; onClick: () => void }) {
  const subject = useStore((s) => (t.subjectId ? s.subjects[t.subjectId] : undefined));
  const tones = useTones(subject?.color ?? '#7a7a7a');
  return (
    <button className="ad-chip task" style={{ boxShadow: `inset 0 0 0 1.5px ${tones.accent}`, color: 'var(--md-on-surface)', opacity: t.done ? 0.5 : 1 }} onClick={onClick}>
      <Icon name={t.type === 'test' ? 'quiz' : t.done ? 'check_circle' : 'assignment'} size={14} style={{ color: tones.accent }} />
      <span className="ellipsis" style={{ textDecoration: t.done ? 'line-through' : undefined }}>
        {t.title}
      </span>
    </button>
  );
}

/* =========================================================
   Month grid
   ========================================================= */
function MonthGrid({ anchor, byDay, onPickDay }: { anchor: number; byDay: Map<string, ResolvedEvent[]>; onPickDay: (d: number) => void }) {
  const now = useNow(60_000);
  const tasks = useStore((s) => s.tasks);
  const dark = useDark();
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  const month = new Date(first).getMonth();
  const offset = (new Date(first).getDay() + 6) % 7;
  const daysInMonth = new Date(new Date(first).getFullYear(), month + 1, 0).getDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
  const { openDetails, openTask } = useEditors.getState();

  return (
    <div className="mg">
      <div className="mg-head">
        {cells.slice(0, 7).map((d) => (
          <div key={d} className="label-m upper muted">
            {fDayShort(d)}
          </div>
        ))}
      </div>
      <div className="mg-grid" style={{ gridTemplateRows: `repeat(${weeks}, minmax(96px, 1fr))` }}>
        {cells.map((d) => {
          const evs = byDay.get(dayKey(d)) ?? [];
          const lessons = evs.filter((e) => e.kind === 'lesson');
          const special = evs.filter((e) => e.kind !== 'lesson');
          const dts = tasks.filter((t) => sameDay(t.due, d) && !t.done);
          const out = new Date(d).getMonth() !== month;
          const today = sameDay(d, now);
          const chips = [...special.map((e) => ({ k: e.id, e })), ...dts.map((t) => ({ k: t.id, t }))];
          return (
            <div key={d} className={'mg-cell' + (out ? ' out' : '') + (today ? ' today' : '')} onClick={() => onPickDay(d)}>
              <div className="mg-date tnum">{new Date(d).getDate()}</div>
              {lessons.length > 0 && (
                <div className="mg-dots" aria-label={`${lessons.length} lessons`}>
                  {lessons.slice(0, 10).map((e) => (
                    <i key={e.id} style={{ background: tonesFor(e.subject?.color ?? '#888', dark).accent }} />
                  ))}
                </div>
              )}
              <div className="mg-chips">
                {chips.slice(0, 3).map((c) =>
                  'e' in c && c.e ? (
                    <MonthChip key={c.k} color={c.e.subject?.color ?? c.e.color} label={eventTitle(c.e)} test={c.e.kind === 'test'} onClick={() => openDetails(c.e!.id)} />
                  ) : 't' in c && c.t ? (
                    <MonthChip key={c.k} color={useStore.getState().subjects[c.t.subjectId ?? '']?.color} label={c.t.title} task test={c.t.type === 'test'} onClick={() => openTask(c.t!)} />
                  ) : null,
                )}
                {chips.length > 3 && <div className="label-s muted">+{chips.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthChip({ color, label, test, task, onClick }: { color?: string; label: string; test?: boolean; task?: boolean; onClick: () => void }) {
  const t = useTones(color ?? '#7a7a7a');
  return (
    <button
      className="mg-chip"
      style={task ? { boxShadow: `inset 0 0 0 1.5px ${t.accent}` } : { background: t.container, color: t.onContainer }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {test ? <Icon name="quiz" size={12} /> : task ? <Icon name="assignment" size={12} style={{ color: t.accent }} /> : null}
      <span className="ellipsis">{label}</span>
    </button>
  );
}

/* =========================================================
   Agenda
   ========================================================= */
function Agenda({ from, byDay }: { from: number; byDay: Map<string, ResolvedEvent[]> }) {
  const now = useNow(30_000);
  const tasks = useStore((s) => s.tasks);
  const toggle = useStore((s) => s.toggleTask);
  const { openDetails, openTask } = useEditors.getState();
  const days = Array.from({ length: 28 }, (_, i) => addDays(from, i)).filter((d) => (byDay.get(dayKey(d))?.length ?? 0) > 0 || tasks.some((t) => sameDay(t.due, d)));
  if (!days.length) return <Empty icon="event" title="Nothing scheduled" text="No events in the next four weeks." />;
  return (
    <div className="agenda">
      {days.map((d) => {
        const evs = byDay.get(dayKey(d)) ?? [];
        const dts = tasks.filter((t) => sameDay(t.due, d));
        const today = sameDay(d, now);
        return (
          <div key={d} className="agenda-day">
            <div className={'agenda-date' + (today ? ' today' : '')}>
              <span className="label-m upper">{fDayShort(d)}</span>
              <span className="tg-date tnum">{new Date(d).getDate()}</span>
              <span className="label-s muted">{fMonth(d)}</span>
            </div>
            <div className="list grow">
              {dts.map((t) => (
                <AgendaTask key={t.id} t={t} onToggle={() => toggle(t.id)} onClick={() => openTask(t)} />
              ))}
              {evs.map((e) => (
                <LessonRow key={e.id} e={e} now={now} onClick={() => openDetails(e.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgendaTask({ t, onToggle, onClick }: { t: Task; onToggle: () => void; onClick: () => void }) {
  const subject = useStore((s) => (t.subjectId ? s.subjects[t.subjectId] : undefined));
  const tones = useTones(subject?.color ?? '#7a7a7a');
  return (
    <div className="list-item clickable" onClick={onClick}>
      <div style={{ width: 50, display: 'grid', justifyItems: 'end', flex: 'none' }}>
        <Check on={t.done} color={tones.accent} onToggle={onToggle} />
      </div>
      <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: tones.accent, flex: 'none' }} />
      <div className="grow">
        <div className="title-s ellipsis" style={{ textDecoration: t.done ? 'line-through' : undefined }}>
          {t.title}
        </div>
        <div className="body-s muted">{[t.type === 'test' ? 'Test' : t.type === 'reminder' ? 'Reminder' : 'Homework', subject?.name, t.hasTime ? fTime(t.due) : null].filter(Boolean).join(' · ')}</div>
      </div>
    </div>
  );
}

/* =========================================================
   Sidebar: mini month + subject filters / colors
   ========================================================= */
function MiniMonth({ value, onPick, byDay }: { value: number; onPick: (d: number) => void; byDay: Map<string, ResolvedEvent[]> }) {
  const [month, setMonth] = useState(startOfMonth(value));
  useEffect(() => setMonth(startOfMonth(value)), [value]);
  const now = Date.now();
  const gridStart = startOfWeek(month);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const m = new Date(month).getMonth();
  return (
    <div className="mini">
      <div className="row" style={{ marginBottom: 6 }}>
        <span className="title-m grow" style={{ paddingLeft: 8 }}>
          {fMonthYear(month)}
        </span>
        <button className="icon-btn sm" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
          <Icon name="chevron_left" size={20} />
        </button>
        <button className="icon-btn sm" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
          <Icon name="chevron_right" size={20} />
        </button>
      </div>
      <div className="mini-grid">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="label-s muted">
            {d}
          </span>
        ))}
        {cells.map((d) => {
          const has = (byDay.get(dayKey(d))?.length ?? 0) > 0;
          return (
            <button
              key={d}
              className={'mini-day tnum' + (new Date(d).getMonth() !== m ? ' out' : '') + (sameDay(d, now) ? ' today' : '') + (sameDay(d, value) ? ' sel' : '')}
              onClick={() => onPick(d)}
            >
              {new Date(d).getDate()}
              {has && <i />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SubjectFilters() {
  const subjects = useSubjectList(true);
  const hidden = useStore((s) => s.settings.hiddenSubjects);
  const sources = useStore((s) => s.sources);
  const hiddenSources = useStore((s) => s.settings.hiddenSources);
  const setSettings = useStore((s) => s.setSettings);
  const [colorFor, setColorFor] = useState<Subject>();
  return (
    <div className="filters">
      <div className="label-m upper muted" style={{ margin: '18px 10px 6px' }}>
        Subjects
      </div>
      {subjects.length === 0 && <div className="body-s muted" style={{ padding: '0 10px' }}>Subjects appear once a school calendar is synced.</div>}
      {subjects.map((s) => {
        const on = !hidden.includes(s.id) && !s.hidden;
        return (
          <div key={s.id} className="filter-row">
            <button
              className="filter-toggle"
              onClick={() => setSettings({ hiddenSubjects: on ? [...hidden, s.id] : hidden.filter((h) => h !== s.id) })}
              aria-pressed={on}
            >
              <FilterBox color={s.color} on={on} />
              <span className="body-m ellipsis">{s.name}</span>
            </button>
            <button className="icon-btn sm" aria-label={`Color for ${s.name}`} onClick={() => setColorFor(s)}>
              <Icon name="palette" size={18} />
            </button>
          </div>
        );
      })}
      {sources.length > 0 && (
        <>
          <div className="label-m upper muted" style={{ margin: '18px 10px 6px' }}>
            Calendars
          </div>
          {sources.map((src) => {
            const on = !hiddenSources.includes(src.id);
            return (
              <div key={src.id} className="filter-row">
                <button className="filter-toggle" onClick={() => setSettings({ hiddenSources: on ? [...hiddenSources, src.id] : hiddenSources.filter((h) => h !== src.id) })} aria-pressed={on}>
                  <FilterBox color={src.color} on={on} />
                  <span className="body-m ellipsis">{src.name}</span>
                </button>
              </div>
            );
          })}
        </>
      )}
      <Sheet open={!!colorFor} onClose={() => setColorFor(undefined)} label="Subject color">
        {colorFor && <ColorPicker subject={colorFor} onDone={() => setColorFor(undefined)} />}
      </Sheet>
    </div>
  );
}

function FilterBox({ color, on }: { color: string; on: boolean }) {
  const t = useTones(color);
  return (
    <span className="filter-box" style={{ background: on ? t.accent : 'transparent', boxShadow: `inset 0 0 0 2px ${t.accent}`, color: t.onAccent }}>
      {on && <Icon name="check" size={16} />}
    </span>
  );
}

export function ColorPicker({ subject, onDone }: { subject: Subject; onDone?: () => void }) {
  const update = useStore((s) => s.updateSubject);
  const live = useStore((s) => s.subjects[subject.id]) ?? subject;
  const t = useTones(live.color);
  return (
    <div>
      <div className="row" style={{ marginBottom: 18 }}>
        <span className="lead" style={{ width: 48, height: 48, borderRadius: 16, display: 'grid', placeItems: 'center', background: t.container, color: t.onContainer }}>
          <SubjectDot color={live.color} size={14} />
        </span>
        <div className="grow">
          <div className="headline-s">{live.name}</div>
          <div className="body-s muted">Used for lessons, tasks and the subject page</div>
        </div>
      </div>
      <div className="color-swatches">
        {SUBJECT_COLORS.map((c) => (
          <button key={c} className={'swatch' + (live.color === c ? ' selected' : '')} style={{ background: c }} aria-label={c} onClick={() => update(subject.id, { color: c })}>
            {live.color === c && <Icon name="check" size={18} />}
          </button>
        ))}
        <label className="swatch" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)', cursor: 'pointer' }} title="Custom color">
          <input type="color" value={live.color} onChange={(e) => update(subject.id, { color: e.target.value })} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </label>
      </div>
      <div className="row" style={{ marginTop: 18 }}>
        <span className="grow body-m">Show in calendar</span>
        <Switch on={!live.hidden} onChange={(v) => update(subject.id, { hidden: !v })} />
      </div>
      {onDone && (
        <div className="sheet-actions">
          <button className="btn filled" onClick={onDone}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}

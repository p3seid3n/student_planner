import { useMemo } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store/store';
import { useEventsByDay, useNow, useSubjectList, useUpcoming, type ResolvedEvent } from '../store/hooks';
import { addDays, dayKey, durationLabel, fFull, fTime, greeting, relativeDay } from '../lib/dates';
import { formatGrade, plusPoints, semesterOf, subjectStats } from '../lib/grades';
import { navigate } from '../router';
import { useEditors } from '../components/editors';
import { eventTitle, LessonRow, SubjectAvatar, UpcomingList } from '../components/items';
import { AddSourceForm, useSyncBusy } from '../components/sources';
import { Empty, GradeChip, Icon, Shape, SPRING, toast, useDark, useTones, WavyLinear } from '../components/ui';
import { gradeTones } from '../theme/theme';
import { syncAll } from '../lib/sync';

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const rise = { initial: { opacity: 0, y: 18, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1, transition: SPRING } };

/** Lessons for today, or the next school day once today is over. */
export function useSchoolDay(now: number) {
  const byDay = useEventsByDay();
  return useMemo(() => {
    const today = (byDay.get(dayKey(now)) ?? []).filter((e) => !e.allDay || e.kind !== 'event');
    const timed = today.filter((e) => !e.allDay);
    const current = timed.find((e) => now >= e.start && now < e.end);
    const next = timed.find((e) => e.start > now);
    const lastEnd = timed.length ? Math.max(...timed.map((e) => e.end)) : 0;
    if (timed.length && now < lastEnd) return { label: 'Today', day: now, events: today, current, next, done: false };
    for (let i = 1; i <= 14; i++) {
      const d = addDays(now, i);
      const evs = byDay.get(dayKey(d)) ?? [];
      if (evs.some((e) => e.kind === 'lesson')) {
        return { label: relativeDay(d, now), day: d, events: evs, current: undefined, next: evs.find((e) => !e.allDay), done: timed.length > 0 };
      }
    }
    return { label: 'Today', day: now, events: today, current, next, done: timed.length > 0 };
  }, [byDay, now]);
}

export default function Home() {
  const name = useStore((s) => s.settings.name);
  const sources = useStore((s) => s.sources);
  const now = useNow(15_000);
  const day = useSchoolDay(now);
  const upcoming = useUpcoming(21);
  const busy = useSyncBusy();
  const { openDetails, openTask } = useEditors.getState();

  return (
    <div className="page-inner">
      <header className="topbar" style={{ alignItems: 'flex-end', marginBottom: 26 }}>
        <div className="grow">
          <motion.div className="label-l muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {fFull(now)}
          </motion.div>
          <motion.h1 className="display-m" style={{ margin: '4px 0 0' }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
            {greeting(new Date(now))}
            {name ? `, ${name}` : ''}
          </motion.h1>
        </div>
        {sources.length > 0 && (
          <button
            className={'icon-btn tonal lg' + (busy ? ' spin' : '')}
            aria-label="Sync calendars"
            onClick={async () => {
              const r = await syncAll();
              toast(r.failed ? `${r.failed} calendar(s) could not sync` : 'Everything is up to date');
            }}
          >
            <Icon name="sync" />
          </button>
        )}
        <button className="icon-btn tonal lg" aria-label="Desk mode" onClick={() => navigate('/desk')} title="Desk mode">
          <Icon name="desktop_windows" />
        </button>
      </header>

      {sources.length === 0 ? (
        <Onboarding />
      ) : (
        <motion.div className="home-grid" variants={stagger} initial="initial" animate="animate">
          <motion.section variants={rise} className="area-now">
            <NowCard day={day} now={now} />
          </motion.section>
          <motion.section variants={rise} className="area-stats">
            <StatsCard upcomingTests={upcoming.filter((u) => u.kind === 'test').length} openTasks={upcoming.filter((u) => u.kind === 'task').length} />
          </motion.section>
          <motion.section variants={rise} className="area-day card">
            <div className="card-head">
              <div className="grow">
                <div className="title-l">{day.label === 'Today' ? 'Today’s lessons' : `${day.label}`}</div>
                <div className="body-s muted">{day.events.filter((e) => e.kind === 'lesson').length} lessons</div>
              </div>
              <button className="btn text sm" onClick={() => navigate('/calendar')}>
                Calendar <Icon name="arrow_forward" size={18} />
              </button>
            </div>
            {day.events.length ? (
              <div className="list">
                {day.events.map((e) => (
                  <LessonRow key={e.id} e={e} now={now} onClick={() => openDetails(e.id)} />
                ))}
              </div>
            ) : (
              <Empty icon="coffee" title="No lessons" text="Nothing on the timetable for the next two weeks." />
            )}
          </motion.section>
          <motion.section variants={rise} className="area-up card">
            <div className="card-head">
              <div className="grow">
                <div className="title-l">Upcoming</div>
                <div className="body-s muted">Tests & tasks · next 3 weeks</div>
              </div>
              <button className="icon-btn tonal" aria-label="Add task" onClick={() => openTask({})}>
                <Icon name="add" />
              </button>
            </div>
            {upcoming.length ? (
              <>
                <UpcomingList items={upcoming} limit={9} />
                {upcoming.length > 9 && (
                  <button className="btn text" style={{ marginTop: 10 }} onClick={() => navigate('/tasks')}>
                    Show all {upcoming.length}
                  </button>
                )}
              </>
            ) : (
              <Empty icon="celebration" title="All clear" text="No tests or homework coming up. Add one with +." />
            )}
          </motion.section>
          <motion.section variants={rise} className="area-grades">
            <RecentGrades />
          </motion.section>
        </motion.div>
      )}
    </div>
  );
}

function NowCard({ day, now }: { day: ReturnType<typeof useSchoolDay>; now: number }) {
  const focus: ResolvedEvent | undefined = day.current ?? day.next;
  const tones = useTones(focus?.subject?.color ?? '#6750a4');
  const { openDetails } = useEditors.getState();
  const after = day.current ? day.events.find((e) => !e.allDay && e.start >= day.current!.end) : undefined;

  if (!focus) {
    return (
      <div className="card now-card" style={{ background: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)', boxShadow: 'none' }}>
        <div className="row" style={{ gap: 18 }}>
          <Shape shape="sunny" size={72} color="var(--md-primary)" spin={30}>
            <Icon name={day.done ? 'celebration' : 'wb_sunny'} size={34} style={{ color: 'var(--md-on-primary)' }} />
          </Shape>
          <div>
            <div className="headline-m">{day.done ? 'Done for today' : 'Free day'}</div>
            <div className="body-m" style={{ opacity: 0.8 }}>
              No more lessons scheduled.
            </div>
          </div>
        </div>
      </div>
    );
  }
  const progress = day.current ? (now - day.current.start) / (day.current.end - day.current.start) : 0;
  return (
    <motion.button layout className="card now-card" onClick={() => openDetails(focus.id)} style={{ background: tones.container, color: tones.onContainer, boxShadow: 'none', textAlign: 'left', width: '100%', display: 'block' }} transition={SPRING}>
      <div className="label-m upper" style={{ opacity: 0.8 }}>
        {day.current ? 'Now' : day.label === 'Today' ? `Next · in ${durationLabel(focus.start - now)}` : `Next · ${day.label}`}
      </div>
      <div className="row" style={{ alignItems: 'flex-start', marginTop: 8, gap: 18 }}>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="display-m" style={{ wordBreak: 'break-word' }}>
            {eventTitle(focus)}
          </div>
          <div className="title-m" style={{ marginTop: 8, opacity: 0.85 }}>
            <span className="tnum">
              {fTime(focus.start)}–{fTime(focus.end)}
            </span>
            {focus.location && <> · Room {focus.location}</>}
            {focus.teacher && <> · {focus.teacher}</>}
          </div>
        </div>
        <SubjectAvatar subject={focus.subject} size={72} strong />
      </div>
      {day.current && (
        <div style={{ marginTop: 22 }}>
          <WavyLinear value={progress} color={tones.accent} track={`color-mix(in srgb, ${tones.onContainer} 18%, transparent)`} height={14} />
          <div className="row body-m" style={{ marginTop: 8, opacity: 0.85 }}>
            <span className="grow">{durationLabel(day.current.end - now)} left</span>
            {after && (
              <span className="ellipsis">
                Then {eventTitle(after)} · {fTime(after.start)}
                {after.location ? ` · ${after.location}` : ''}
              </span>
            )}
          </div>
        </div>
      )}
    </motion.button>
  );
}

function StatsCard({ upcomingTests, openTasks }: { upcomingTests: number; openTasks: number }) {
  const subjects = useSubjectList();
  const grades = useStore((s) => s.grades);
  const settings = useStore((s) => s.settings);
  const dark = useDark();
  const sem = semesterOf(Date.now());
  const stats = subjects.filter((s) => s.counts).map((s) => subjectStats(s, grades, sem.key, settings.rounding));
  const avgs = stats.map((s) => s.average).filter((a): a is number => a !== undefined);
  const overall = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : undefined;
  const pp = plusPoints(avgs, settings.passMark, settings.rounding);
  const t = gradeTones(overall, dark);
  return (
    <div className="card stats-card" style={{ height: '100%' }}>
      <div className="row" style={{ gap: 18, alignItems: 'center' }}>
        <Shape shape="cookie12" size={112} color={t.container} spin={60}>
          <div style={{ textAlign: 'center', color: t.onContainer }}>
            <div className="headline-l tnum" style={{ lineHeight: 1 }}>
              {formatGrade(overall)}
            </div>
            <div className="label-s upper" style={{ opacity: 0.8, marginTop: 2 }}>
              Ø {sem.label}
            </div>
          </div>
        </Shape>
        <div className="grow stat-list">
          {settings.showPlusPoints && avgs.length > 0 && (
            <Stat icon="star" label="Plus points" value={(pp.points >= 0 ? '+' : '') + formatGrade(pp.points, 1)} warn={pp.points < 0} />
          )}
          <Stat icon="quiz" label="Tests ahead" value={String(upcomingTests)} />
          <Stat icon="assignment" label="Open tasks" value={String(openTasks)} />
        </div>
      </div>
      <button className="btn tonal" style={{ width: '100%', marginTop: 16 }} onClick={() => navigate('/subjects')}>
        <Icon name="school" size={20} /> All subjects & grades
      </button>
    </div>
  );
}

function Stat({ icon, label, value, warn }: { icon: string; label: string; value: string; warn?: boolean }) {
  return (
    <div className="row" style={{ gap: 10, padding: '4px 0' }}>
      <Icon name={icon} size={20} style={{ color: warn ? 'var(--md-error)' : 'var(--md-primary)' }} />
      <span className="grow body-m muted">{label}</span>
      <span className="title-l tnum" style={{ color: warn ? 'var(--md-error)' : undefined }}>
        {value}
      </span>
    </div>
  );
}

function RecentGrades() {
  const grades = useStore((s) => s.grades);
  const subjects = useStore((s) => s.subjects);
  const recent = useMemo(() => [...grades].sort((a, b) => b.date - a.date).slice(0, 8), [grades]);
  const { openGrade } = useEditors.getState();
  return (
    <div className="card">
      <div className="card-head">
        <div className="grow title-l">Latest grades</div>
        <button className="icon-btn tonal" aria-label="Add grade" onClick={() => openGrade({})}>
          <Icon name="add" />
        </button>
      </div>
      {recent.length ? (
        <div className="grade-strip">
          {recent.map((g) => (
            <button key={g.id} className="grade-tile" onClick={() => openGrade(g)}>
              <GradeChip value={g.value} lg />
              <div className="title-s ellipsis" style={{ marginTop: 10 }}>
                {subjects[g.subjectId]?.name ?? 'Subject'}
              </div>
              <div className="body-s muted ellipsis">{g.title}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="body-m muted" style={{ padding: '4px 4px 8px' }}>
          No grades yet — add them per subject, or import them from schulNetz in Settings.
        </div>
      )}
    </div>
  );
}

function Onboarding() {
  return (
    <motion.div className="onboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
      <div className="card" style={{ padding: 'clamp(20px, 4vw, 40px)' }}>
        <div className="row" style={{ gap: 20, alignItems: 'flex-start', marginBottom: 24 }}>
          <Shape shape="flower" size={80} color="var(--md-tertiary-container)" spin={24}>
            <Icon name="calendar_month" size={36} style={{ color: 'var(--md-on-tertiary-container)' }} />
          </Shape>
          <div>
            <div className="headline-l">Connect your timetable</div>
            <div className="body-l muted" style={{ marginTop: 6, maxWidth: 560 }}>
              Paste your school’s iCal link. Lessons become subjects automatically — each gets its own page for grades, tests and homework.
            </div>
          </div>
        </div>
        <AddSourceForm />
      </div>
      <div className="body-s muted" style={{ textAlign: 'center', marginTop: 16 }}>
        Everything is stored on this device. Add more calendars (Outlook / Teams) later in Settings.
      </div>
    </motion.div>
  );
}

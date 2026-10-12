import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store/store';
import { useSubjectList, useUpcoming } from '../store/hooks';
import { formatGrade, plusPoints, semesterOf, subjectStats, type SubjectStats } from '../lib/grades';
import { daysUntil } from '../lib/dates';
import { navigate } from '../router';
import { useEditors } from '../components/editors';
import { SubjectAvatar } from '../components/items';
import { Empty, GradeChip, Icon, Shape, SPRING, useDark, useTones } from '../components/ui';
import { gradeTones } from '../theme/theme';
import type { Grade, UpcomingItem } from '../lib/types';

export function useSemesters() {
  const grades = useStore((s) => s.grades);
  return useMemo(() => {
    const map = new Map<string, ReturnType<typeof semesterOf>>();
    const cur = semesterOf(Date.now());
    map.set(cur.key, cur);
    for (const g of grades) {
      const s = semesterOf(g.date);
      map.set(s.key, s);
    }
    return [...map.values()].sort((a, b) => b.start - a.start);
  }, [grades]);
}

export function SemesterChips({ value, onChange }: { value: string | undefined; onChange: (v: string | undefined) => void }) {
  const sems = useSemesters();
  return (
    <div className="chips scroll">
      {sems.map((s) => (
        <button key={s.key} className={'chip' + (value === s.key ? ' selected' : '')} onClick={() => onChange(s.key)}>
          {value === s.key && <Icon name="check" size={18} />}
          {s.label}
        </button>
      ))}
      <button className={'chip' + (value === undefined ? ' selected' : '')} onClick={() => onChange(undefined)}>
        {value === undefined && <Icon name="check" size={18} />}
        All time
      </button>
    </div>
  );
}

export const useSemesterPref = (() => {
  let current: string | undefined = semesterOf(Date.now()).key;
  return () => {
    const [v, setV] = useState(current);
    return [v, (n: string | undefined) => setV((current = n))] as const;
  };
})();

export default function Subjects() {
  const subjects = useSubjectList(true);
  const grades = useStore((s) => s.grades);
  const settings = useStore((s) => s.settings);
  const [sem, setSem] = useSemesterPref();
  const dark = useDark();
  const { openGrade } = useEditors.getState();
  const upcoming = useUpcoming(30, false);
  const addSubject = useStore((s) => s.addSubject);

  const visible = subjects.filter((s) => !s.hidden);
  const hidden = subjects.filter((s) => s.hidden);
  const stats = visible.map((s) => subjectStats(s, grades, sem, settings.rounding));
  const counted = stats.filter((s) => s.subject.counts && s.average !== undefined).map((s) => s.average!);
  const overall = counted.length ? counted.reduce((a, b) => a + b, 0) / counted.length : undefined;
  const pp = plusPoints(counted, settings.passMark, settings.rounding);
  const nGrades = stats.reduce((n, s) => n + s.grades.length, 0);
  const t = gradeTones(overall, dark);

  return (
    <div className="page-inner">
      <header className="topbar">
        <h1 className="display-m grow" style={{ margin: 0 }}>
          Subjects
        </h1>
        <button className="btn tonal" onClick={() => openGrade({})} disabled={!subjects.length}>
          <Icon name="add" size={20} /> Grade
        </button>
      </header>
      <SemesterChips value={sem} onChange={setSem} />

      {subjects.length === 0 ? (
        <Empty
          icon="school"
          title="No subjects yet"
          text="Connect your school calendar and every course becomes a subject automatically — or add one by hand."
          action={
            <div className="row">
              <button className="btn filled" onClick={() => navigate('/settings')}>
                Connect calendar
              </button>
              <button className="btn outlined" onClick={() => addSubject({ name: 'New subject', short: 'New', color: '#3f51b5' })}>
                Add manually
              </button>
            </div>
          }
        />
      ) : (
        <>
          <motion.div className="summary-band" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
            <Shape shape="cookie12" size={96} color={t.container} spin={60}>
              <span className="headline-m tnum" style={{ color: t.onContainer }}>
                {formatGrade(overall)}
              </span>
            </Shape>
            <div className="summary-stats">
              <div>
                <div className="label-m upper muted">Average</div>
                <div className="headline-s tnum">{formatGrade(overall)}</div>
              </div>
              {settings.showPlusPoints && (
                <div>
                  <div className="label-m upper muted">Plus points</div>
                  <div className="headline-s tnum" style={{ color: pp.points < 0 ? 'var(--md-error)' : undefined }}>
                    {pp.points >= 0 ? '+' : ''}
                    {formatGrade(pp.points, 1)}
                  </div>
                </div>
              )}
              <div>
                <div className="label-m upper muted">Below {settings.passMark}</div>
                <div className="headline-s tnum" style={{ color: pp.insufficient ? 'var(--md-error)' : undefined }}>
                  {pp.insufficient}
                </div>
              </div>
              <div>
                <div className="label-m upper muted">Grades</div>
                <div className="headline-s tnum">{nGrades}</div>
              </div>
            </div>
          </motion.div>

          <motion.div className="subject-grid" initial="i" animate="a" variants={{ a: { transition: { staggerChildren: 0.035 } } }}>
            {stats.map((s) => (
              <SubjectCard key={s.subject.id} stats={s} upcomingAll={upcoming} />
            ))}
          </motion.div>

          {hidden.length > 0 && (
            <>
              <div className="section-title">
                <span className="title-m muted">Hidden</span>
              </div>
              <div className="chips">
                {hidden.map((s) => (
                  <button key={s.id} className="chip" onClick={() => navigate(`/subjects/${encodeURIComponent(s.id)}`)}>
                    <Icon name="visibility_off" size={18} /> {s.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <div style={{ marginTop: 24 }}>
            <button className="btn text" onClick={() => {
              const id = addSubject({ name: 'New subject', short: 'New', color: '#00897b' });
              navigate(`/subjects/${id}`);
            }}>
              <Icon name="add" size={20} /> Add subject manually
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SubjectCard({ stats, upcomingAll }: { stats: SubjectStats; upcomingAll: UpcomingItem[] }) {
  const { subject, grades, average, rounded } = stats;
  const tones = useTones(subject.color);
  const upcoming = upcomingAll.filter((u) => u.subjectId === subject.id);
  const nextTest = upcoming.find((u) => u.kind === 'test');
  const tasks = upcoming.filter((u) => u.kind === 'task').length;
  return (
    <motion.button
      className="subject-card"
      variants={{ i: { opacity: 0, y: 16, scale: 0.97 }, a: { opacity: 1, y: 0, scale: 1, transition: SPRING } }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/subjects/${encodeURIComponent(subject.id)}`)}
      style={{ background: tones.soft, ['--accent' as string]: tones.accent }}
    >
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <motion.div layoutId={'avatar-' + subject.id} transition={SPRING}>
          <SubjectAvatar subject={subject} size={52} />
        </motion.div>
        <div className="grow" />
        <GradeChip value={average} lg />
      </div>
      <div className="title-l ellipsis" style={{ marginTop: 14 }}>
        {subject.name}
      </div>
      <div className="body-s muted ellipsis">
        {[subject.teacher, grades.length ? `${grades.length} grade${grades.length > 1 ? 's' : ''}` : 'No grades', rounded !== undefined ? `Zeugnis ${formatGrade(rounded, 1)}` : null].filter(Boolean).join(' · ')}
      </div>
      <Sparkline grades={grades} color={tones.accent} />
      <div className="chips" style={{ marginTop: 6, minHeight: 22 }}>
        {nextTest && <span className={'badge' + (daysUntil(nextTest.due) <= 3 ? ' error' : '')}>Test in {Math.max(0, daysUntil(nextTest.due))} d</span>}
        {tasks > 0 && <span className="badge outline">{tasks} task{tasks > 1 ? 's' : ''}</span>}
      </div>
    </motion.button>
  );
}

export function Sparkline({ grades, color, height = 36 }: { grades: Grade[]; color: string; height?: number }) {
  if (grades.length < 2) return <div style={{ height, marginTop: 10 }} />;
  const w = 200;
  const xs = grades.map((_, i) => (i / (grades.length - 1)) * w);
  const ys = grades.map((g) => height - ((g.value - 1) / 5) * (height - 6) - 3);
  const d = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  const passY = height - ((4 - 1) / 5) * (height - 6) - 3;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" width="100%" height={height} style={{ marginTop: 10, overflow: 'visible' }}>
      <line x1={0} x2={w} y1={passY} y2={passY} stroke="currentColor" strokeOpacity={0.18} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

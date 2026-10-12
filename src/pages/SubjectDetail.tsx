import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../store/store';
import { useCodeIndex, useSubjectList, useUpcoming } from '../store/hooks';
import { formatGrade, gradesForSubject, parseGradeInput, requiredGrade, roundTo, weightedAverage } from '../lib/grades';
import { DAY, fDate, fDayLong, fTime, startOfDay } from '../lib/dates';
import { eventSubjectId, variantLabel } from '../lib/subjects';
import type { Grade } from '../lib/types';
import { back, navigate } from '../router';
import { useEditors } from '../components/editors';
import { SubjectAvatar, UpcomingList } from '../components/items';
import { Empty, Field, GradeChip, Icon, Shape, SPRING, Switch, toast, useDark, useTones } from '../components/ui';
import { gradeTones } from '../theme/theme';
import { ColorPicker } from './Calendar';
import { SemesterChips, useSemesterPref } from './Subjects';

export default function SubjectDetail({ id }: { id: string }) {
  const subject = useStore((s) => s.subjects[id]);
  const allGrades = useStore((s) => s.grades);
  const rounding = useStore((s) => s.settings.rounding);
  const [sem, setSem] = useSemesterPref();
  const tones = useTones(subject?.color ?? '#777');
  const dark = useDark();
  const upcoming = useUpcoming(120).filter((u) => u.subjectId === id);
  const { openGrade, openTask } = useEditors.getState();

  if (!subject) {
    return (
      <div className="page-inner">
        <Empty icon="school" title="Subject not found" action={<button className="btn filled" onClick={() => navigate('/subjects')}>All subjects</button>} />
      </div>
    );
  }
  const grades = gradesForSubject(allGrades, id, sem);
  const avg = weightedAverage(grades);
  const gt = gradeTones(avg, dark);

  return (
    <div className="page-inner">
      <header className="topbar">
        <button className="icon-btn tonal" aria-label="Back" onClick={() => back('/subjects')}>
          <Icon name="arrow_back" />
        </button>
        <div className="grow" />
        <button className="btn tonal" onClick={() => openTask({ subjectId: id })}>
          <Icon name="add_task" size={20} /> Task
        </button>
        <button className="btn filled" onClick={() => openGrade({ subjectId: id })}>
          <Icon name="add" size={20} /> Grade
        </button>
      </header>

      <motion.section className="subject-hero" style={{ background: tones.container, color: tones.onContainer }} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING}>
        <motion.div layoutId={'avatar-' + subject.id} transition={SPRING}>
          <SubjectAvatar subject={subject} size={84} strong />
        </motion.div>
        <div className="grow" style={{ minWidth: 0 }}>
          <h1 className="display-m" style={{ margin: 0, wordBreak: 'break-word' }}>
            {subject.name}
          </h1>
          <div className="title-m" style={{ opacity: 0.8, marginTop: 6 }}>
            {[subject.teacher, subject.codes.join(' · ')].filter(Boolean).join('  ·  ') || 'Manual subject'}
          </div>
        </div>
        <Shape shape="cookie9" size={124} color={gt.accent} spin={50} className="hero-avg">
          <div style={{ textAlign: 'center', color: gt.onAccent }}>
            <div className="display-m tnum" style={{ fontSize: 38, lineHeight: 1 }}>
              {formatGrade(avg)}
            </div>
            <div className="label-s upper" style={{ marginTop: 4, opacity: 0.85 }}>
              {avg !== undefined ? `Zeugnis ${formatGrade(roundTo(avg, rounding), 1)}` : 'No grades'}
            </div>
          </div>
        </Shape>
      </motion.section>

      <div style={{ marginTop: 18 }}>
        <SemesterChips value={sem} onChange={setSem} />
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="card">
            <div className="card-head">
              <div className="grow title-l">Grades</div>
              <span className="body-s muted">{grades.length} total · weights in ×</span>
            </div>
            {grades.length >= 2 && <GradeChart grades={grades} color={tones.accent} />}
            {grades.length ? (
              <div className="list" style={{ marginTop: 12 }}>
                <AnimatePresence initial={false}>
                  {[...grades].reverse().map((g) => (
                    <motion.button key={g.id} layout="position" className="list-item" onClick={() => openGrade(g)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING}>
                      <GradeChip value={g.value} />
                      <div className="grow">
                        <div className="title-s ellipsis">{g.title}</div>
                        <div className="body-s muted">
                          {fDate(g.date)}
                          {g.source === 'schulnetz' && ' · schulNetz'}
                        </div>
                      </div>
                      <span className="badge outline tnum">×{formatGrade(g.weight)}</span>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <Empty icon="award_star" title="No grades yet" text="Add your first grade to see your average." action={<button className="btn tonal" onClick={() => openGrade({ subjectId: id })}>Add grade</button>} />
            )}
          </section>

          <section className="card" style={{ marginTop: 14 }}>
            <div className="card-head">
              <div className="grow title-l">Upcoming</div>
              <button className="btn text sm" onClick={() => openTask({ subjectId: id, type: 'test' })}>
                <Icon name="quiz" size={18} /> Test
              </button>
              <button className="btn text sm" onClick={() => openTask({ subjectId: id })}>
                <Icon name="add_task" size={18} /> Homework
              </button>
            </div>
            {upcoming.length ? <UpcomingList items={upcoming} /> : <div className="body-m muted" style={{ padding: 4 }}>Nothing due for {subject.short || subject.name}.</div>}
          </section>
        </div>

        <div className="detail-side">
          <Calculator grades={grades} target={subject.target} onTarget={(t) => useStore.getState().updateSubject(id, { target: t })} />
          <Schedule subjectId={id} />
          <SubjectSettings id={id} />
        </div>
      </div>
    </div>
  );
}

/* ---------- grade chart with running average ---------- */
function GradeChart({ grades, color }: { grades: Grade[]; color: string }) {
  const dark = useDark();
  const W = 600;
  const H = 180;
  const pad = { l: 28, r: 12, t: 12, b: 22 };
  const t0 = grades[0].date;
  const t1 = grades[grades.length - 1].date;
  const span = Math.max(DAY, t1 - t0);
  const x = (t: number) => pad.l + ((t - t0) / span) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + ((6 - v) / 5) * (H - pad.t - pad.b);
  const running = grades.map((_, i) => weightedAverage(grades.slice(0, i + 1))!);
  const path = running.map((v, i) => `${i ? 'L' : 'M'}${x(grades[i].date).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxHeight: 220 }} role="img" aria-label="Grade history">
      {[1, 2, 3, 4, 5, 6].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={v === 4 ? 0.35 : 0.1} strokeDasharray={v === 4 ? '4 4' : undefined} />
          <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor" opacity={0.55}>
            {v}
          </text>
        </g>
      ))}
      <motion.path d={path} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: [0.2, 0, 0, 1] }} />
      {grades.map((g, i) => {
        const t = gradeTones(g.value, dark);
        return (
          <motion.circle key={g.id} cx={x(g.date)} cy={y(g.value)} r={4 + Math.min(4, g.weight * 2)} fill={t.accent} stroke="var(--md-surface-container-low)" strokeWidth={2} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING, delay: 0.05 * i }}>
            <title>{`${g.title}: ${formatGrade(g.value)} (×${g.weight})`}</title>
          </motion.circle>
        );
      })}
      <text x={pad.l} y={H - 4} fontSize="11" fill="currentColor" opacity={0.55}>
        {fDate(t0)}
      </text>
      <text x={W - pad.r} y={H - 4} fontSize="11" textAnchor="end" fill="currentColor" opacity={0.55}>
        {fDate(t1)}
      </text>
    </svg>
  );
}

/* ---------- "what do I need" calculator ---------- */
function Calculator({ grades, target, onTarget }: { grades: Grade[]; target?: number; onTarget: (t: number) => void }) {
  const avg = weightedAverage(grades);
  const defTarget = target ?? (avg !== undefined ? Math.min(6, Math.ceil((avg + 0.01) * 2) / 2) : 5);
  const [targetStr, setTargetStr] = useState(String(defTarget));
  const [weightStr, setWeightStr] = useState('1');
  const tgt = parseGradeInput(targetStr);
  const w = parseGradeInput(weightStr) ?? 1;
  const need = tgt !== undefined ? requiredGrade(grades, tgt, w) : undefined;
  const dark = useDark();
  const nt = gradeTones(need !== undefined ? Math.max(1, Math.min(6, need)) : undefined, dark);

  let verdict = '';
  if (need === undefined) verdict = 'Enter a target average.';
  else if (!grades.length) verdict = `Your first grade sets the average.`;
  else if (need > 6) verdict = 'Not reachable with one grade — aim for the next test too.';
  else if (need <= 1) verdict = 'Already safe — even a 1 keeps you there.';
  else verdict = `You need at least ${formatGrade(Math.ceil(need * 4) / 4)} on the next ×${formatGrade(w)} grade.`;

  const whatIf = [3, 3.5, 4, 4.5, 5, 5.5, 6].map((v) => ({ v, avg: weightedAverage([...grades, { id: 'x', subjectId: '', value: v, weight: w, title: '', date: 0 }])! }));

  return (
    <section className="card">
      <div className="card-head">
        <Icon name="calculate" style={{ color: 'var(--md-primary)' }} />
        <div className="grow title-l">Grade calculator</div>
      </div>
      <div className="row">
        <Field label="Target average">
          <input
            className="input tnum"
            inputMode="decimal"
            value={targetStr}
            onChange={(e) => setTargetStr(e.target.value)}
            onBlur={() => tgt !== undefined && onTarget(tgt)}
          />
        </Field>
        <Field label="Next weight">
          <input className="input tnum" inputMode="decimal" value={weightStr} onChange={(e) => setWeightStr(e.target.value)} />
        </Field>
      </div>
      <motion.div layout className="calc-result" style={{ background: nt.container, color: nt.onContainer }} transition={SPRING}>
        <div className="display-m tnum" style={{ fontSize: 40 }}>
          {need === undefined || !grades.length ? '–' : need > 6 ? '> 6' : need <= 1 ? '✓' : formatGrade(Math.ceil(need * 4) / 4)}
        </div>
        <div className="body-m" style={{ opacity: 0.9 }}>
          {verdict}
        </div>
      </motion.div>
      {grades.length > 0 && (
        <>
          <div className="label-m upper muted" style={{ margin: '16px 4px 8px' }}>
            What if the next grade is…
          </div>
          <div className="whatif">
            {whatIf.map((r) => (
              <div key={r.v} className="whatif-cell">
                <GradeChip value={r.v} digits={1} style={{ minWidth: 40, height: 28, fontSize: 13 }} />
                <span className="body-s tnum muted">→ {formatGrade(r.avg)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ---------- weekly schedule derived from the timetable ---------- */
function Schedule({ subjectId }: { subjectId: string }) {
  const events = useStore((s) => s.events);
  const codeIndex = useCodeIndex();
  const slots = useMemo(() => {
    const from = startOfDay(Date.now());
    const to = from + 21 * DAY;
    const map = new Map<string, { dow: number; start: number; end: number; rooms: Set<string>; variant?: string }>();
    for (const e of events) {
      if (e.start < from || e.start > to || e.kind !== 'lesson') continue;
      if (eventSubjectId(e, codeIndex) !== subjectId) continue;
      const dow = (new Date(e.start).getDay() + 6) % 7;
      const k = `${dow}-${fTime(e.start)}`;
      const ex = map.get(k);
      if (ex) {
        if (e.location) ex.rooms.add(e.location);
      } else map.set(k, { dow, start: e.start, end: e.end, rooms: new Set(e.location ? [e.location] : []), variant: variantLabel(e.code) });
    }
    return [...map.values()].sort((a, b) => a.dow - b.dow || fTime(a.start).localeCompare(fTime(b.start)));
  }, [events, codeIndex, subjectId]);
  if (!slots.length) return null;
  return (
    <section className="card" style={{ marginTop: 14 }}>
      <div className="card-head">
        <Icon name="schedule" style={{ color: 'var(--md-primary)' }} />
        <div className="grow title-l">Weekly schedule</div>
        <span className="badge outline">{slots.length} lessons</span>
      </div>
      <div className="list">
        {slots.map((s) => (
          <div key={`${s.dow}-${s.start}`} className="list-item" style={{ minHeight: 48 }}>
            <span className="title-s" style={{ width: 92 }}>
              {fDayLong(s.start)}
            </span>
            <span className="tnum body-m grow">
              {fTime(s.start)}–{fTime(s.end)}
            </span>
            {s.variant && <span className="badge outline">{s.variant}</span>}
            <span className="body-s muted">{[...s.rooms].join(', ')}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- subject settings ---------- */
function SubjectSettings({ id }: { id: string }) {
  const subject = useStore((s) => s.subjects[id]);
  const { updateSubject, mergeSubject, moveCode, deleteSubject, restore } = useStore.getState();
  const others = useSubjectList(true).filter((s) => s.id !== id);
  const [open, setOpen] = useState(false);
  if (!subject) return null;
  return (
    <section className="card" style={{ marginTop: 14 }}>
      <button className="card-head" style={{ width: '100%', marginBottom: open ? 14 : 0 }} onClick={() => setOpen(!open)}>
        <Icon name="tune" style={{ color: 'var(--md-primary)' }} />
        <div className="grow title-l" style={{ textAlign: 'left' }}>
          Customize
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={SPRING} style={{ display: 'grid' }}>
          <Icon name="keyboard_arrow_down" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING} style={{ overflow: 'hidden' }}>
            <div className="stack">
              <div className="row">
                <Field label="Name">
                  <input className="input" value={subject.name} onChange={(e) => updateSubject(id, { name: e.target.value })} />
                </Field>
                <Field label="Short">
                  <input className="input" style={{ width: 90 }} value={subject.short} onChange={(e) => updateSubject(id, { short: e.target.value })} />
                </Field>
              </div>
              <Field label="Teacher">
                <input className="input" value={subject.teacher ?? ''} onChange={(e) => updateSubject(id, { teacher: e.target.value })} />
              </Field>
              <ColorPicker subject={subject} />
              <label className="row" style={{ cursor: 'pointer' }}>
                <span className="grow body-m">Counts towards overall average & plus points</span>
                <Switch on={subject.counts} onChange={(v) => updateSubject(id, { counts: v })} />
              </label>
              {subject.codes.length > 0 && (
                <Field label="Timetable codes">
                  <div className="list">
                    {subject.codes.map((c) => (
                      <div key={c} className="list-item" style={{ minHeight: 48 }}>
                        <span className="title-s grow">
                          {c} <span className="muted body-s">{variantLabel(c) ?? ''}</span>
                        </span>
                        {others.length > 0 && (
                          <select
                            className="input"
                            style={{ height: 36, width: 'auto', fontSize: 13 }}
                            value=""
                            onChange={(e) => {
                              if (!e.target.value) return;
                              moveCode(c, e.target.value);
                              toast(`${c} moved to ${useStore.getState().subjects[e.target.value]?.name}`);
                            }}
                          >
                            <option value="">Move to…</option>
                            {others.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                </Field>
              )}
              {others.length > 0 && (
                <Field label="Merge this subject into…">
                  <select
                    className="input"
                    value=""
                    onChange={(e) => {
                      const into = e.target.value;
                      if (!into) return;
                      const snap = { subjects: useStore.getState().subjects, grades: useStore.getState().grades, tasks: useStore.getState().tasks, events: useStore.getState().events };
                      mergeSubject(id, into);
                      navigate(`/subjects/${encodeURIComponent(into)}`, { replace: true });
                      toast('Subjects merged', { label: 'Undo', run: () => restore(snap) });
                    }}
                  >
                    <option value="">Choose subject</option>
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Notes">
                <textarea className="input" placeholder="Book, exam dates, teacher’s rules…" value={subject.notes ?? ''} onChange={(e) => updateSubject(id, { notes: e.target.value })} />
              </Field>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button className="btn outlined" onClick={() => updateSubject(id, { hidden: !subject.hidden })}>
                  <Icon name={subject.hidden ? 'visibility' : 'visibility_off'} size={20} /> {subject.hidden ? 'Unhide' : 'Hide subject'}
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    const snap = { subjects: useStore.getState().subjects, grades: useStore.getState().grades, tasks: useStore.getState().tasks };
                    deleteSubject(id);
                    navigate('/subjects', { replace: true });
                    toast('Subject deleted', { label: 'Undo', run: () => restore(snap) });
                  }}
                >
                  <Icon name="delete" size={20} /> Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

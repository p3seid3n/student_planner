import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { create } from 'zustand';
import { useStore } from '../store/store';
import { useCodeIndex, useSubjectList } from '../store/hooks';
import { eventSubjectId, subjectIcon, variantLabel } from '../lib/subjects';
import { addDays, DAY, fDate, fFull, fromInputs, fTime, HOUR, relativeDay, startOfDay, toInputDate, toInputTime } from '../lib/dates';
import { formatGrade, parseGradeInput, weightedAverage } from '../lib/grades';
import type { CalEvent, Grade, Task, TaskType } from '../lib/types';
import { navigate } from '../router';
import { Check, Field, GradeChip, Icon, Segmented, Sheet, Shape, SPRING, Switch, toast, useTones } from './ui';

/* ---------- global editor state ---------- */
type EditorState = {
  task?: Partial<Task>;
  grade?: Partial<Grade>;
  event?: Partial<CalEvent>;
  details?: string; // event id
  openTask: (t?: Partial<Task>) => void;
  openGrade: (g?: Partial<Grade>) => void;
  openEvent: (e?: Partial<CalEvent>) => void;
  openDetails: (id: string) => void;
  close: (k: 'task' | 'grade' | 'event' | 'details') => void;
};
export const useEditors = create<EditorState>((set) => ({
  openTask: (t = {}) => set({ task: t }),
  openGrade: (g = {}) => set({ grade: g }),
  openEvent: (e = {}) => set({ event: e }),
  openDetails: (id) => set({ details: id }),
  close: (k) => set({ [k]: undefined } as Partial<EditorState>),
}));

export function EditorHost() {
  const { task, grade, event, details, close } = useEditors();
  return (
    <>
      <Sheet open={!!details} onClose={() => close('details')} label="Event details">
        {details && <EventDetails id={details} />}
      </Sheet>
      <Sheet open={!!task} onClose={() => close('task')} label="Task">
        {task && <TaskEditor initial={task} onDone={() => close('task')} />}
      </Sheet>
      <Sheet open={!!grade} onClose={() => close('grade')} label="Grade">
        {grade && <GradeEditor initial={grade} onDone={() => close('grade')} />}
      </Sheet>
      <Sheet open={!!event} onClose={() => close('event')} label="Event">
        {event && <EventEditor initial={event} onDone={() => close('event')} />}
      </Sheet>
    </>
  );
}

/** Next lesson of a subject after `after` (used for "due next lesson"). */
export function useNextLesson() {
  const events = useStore((s) => s.events);
  const codeIndex = useCodeIndex();
  return (subjectId: string | undefined, after = Date.now()) => {
    if (!subjectId) return undefined;
    return events.find((e) => e.kind === 'lesson' && e.start > after + 30 * 60_000 && eventSubjectId(e, codeIndex) === subjectId);
  };
}

function SubjectSelect({ value, onChange, allowNone = true }: { value?: string; onChange: (v: string | undefined) => void; allowNone?: boolean }) {
  const subjects = useSubjectList(true);
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      {allowNone && <option value="">No subject</option>}
      {subjects.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

/* =========================================================
   Task editor
   ========================================================= */
function TaskEditor({ initial, onDone }: { initial: Partial<Task>; onDone: () => void }) {
  const { addTask, updateTask, deleteTask, restore } = useStore.getState();
  const nextLesson = useNextLesson();
  const isNew = !initial.id;
  const [title, setTitle] = useState(initial.title ?? '');
  const [type, setType] = useState<TaskType>(initial.type ?? 'homework');
  const [subjectId, setSubjectId] = useState(initial.subjectId);
  const [due, setDue] = useState(initial.due ?? startOfDay(Date.now()) + DAY);
  const [hasTime, setHasTime] = useState(initial.hasTime ?? false);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const next = nextLesson(subjectId);
  const subject = useStore((s) => (subjectId ? s.subjects[subjectId] : undefined));

  const save = () => {
    const t = title.trim() || (type === 'test' ? `Test${subject ? ' ' + subject.name : ''}` : subject ? `${subject.name} homework` : '');
    if (!t) return;
    const data = { title: t, type, subjectId, due, hasTime, notes: notes.trim() || undefined, eventId: initial.eventId };
    if (isNew) {
      addTask(data);
      toast(type === 'test' ? 'Test added' : 'Task added');
    } else updateTask(initial.id!, data);
    onDone();
  };

  const quick = [
    { label: 'Today', due: startOfDay(Date.now()) },
    { label: 'Tomorrow', due: startOfDay(Date.now()) + DAY },
    { label: 'In a week', due: startOfDay(addDays(Date.now(), 7)) },
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="sheet-head">
        <div className="grow headline-s">{isNew ? (type === 'test' ? 'New test' : 'New task') : 'Edit'}</div>
        {!isNew && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Delete"
            onClick={() => {
              const snap = useStore.getState().tasks;
              deleteTask(initial.id!);
              toast('Deleted', { label: 'Undo', run: () => restore({ tasks: snap }) });
              onDone();
            }}
          >
            <Icon name="delete" />
          </button>
        )}
      </div>
      <div className="stack">
        <input className="input" style={{ height: 60, fontSize: 18, fontWeight: 600 }} autoFocus={isNew} placeholder={type === 'test' ? 'What is the test about?' : 'What needs to be done?'} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Segmented
          layoutId="task-type"
          value={type}
          onChange={setType}
          options={[
            { value: 'homework', label: 'Homework', icon: 'assignment' },
            { value: 'test', label: 'Test', icon: 'quiz' },
            { value: 'reminder', label: 'Reminder', icon: 'notifications' },
          ]}
        />
        <Field label="Subject">
          <SubjectSelect value={subjectId} onChange={setSubjectId} />
        </Field>
        <Field label="Due">
          <div className="chips">
            {next && (
              <button type="button" className={'chip' + (due === next.start ? ' selected' : '')} onClick={() => (setDue(next.start), setHasTime(true))}>
                <Icon name="event" size={18} /> Next lesson · {relativeDay(next.start)} {fTime(next.start)}
              </button>
            )}
            {quick.map((q) => (
              <button key={q.label} type="button" className={'chip' + (!hasTime && startOfDay(due) === q.due ? ' selected' : '')} onClick={() => (setDue(q.due), setHasTime(false))}>
                {q.label}
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input
              className="input"
              type="date"
              value={toInputDate(due)}
              onChange={(e) => e.target.value && setDue(fromInputs(e.target.value, hasTime ? toInputTime(due) : undefined))}
            />
            {hasTime && <input className="input" type="time" value={toInputTime(due)} onChange={(e) => setDue(fromInputs(toInputDate(due), e.target.value))} />}
            <label className="row label-l" style={{ gap: 8, flex: 'none', cursor: 'pointer' }}>
              <Switch on={hasTime} onChange={(v) => (setHasTime(v), v && toInputTime(due) === '00:00' && setDue(startOfDay(due) + 8 * HOUR))} label="Set time" />
              Time
            </label>
          </div>
        </Field>
        <Field label="Notes">
          <textarea className="input" placeholder="Pages, exercises, chapters…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <div className="sheet-actions">
        <button type="button" className="btn text" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn filled">
          <Icon name="check" size={20} /> Save
        </button>
      </div>
    </form>
  );
}

/* =========================================================
   Grade editor
   ========================================================= */
function GradeEditor({ initial, onDone }: { initial: Partial<Grade>; onDone: () => void }) {
  const { addGrade, updateGrade, deleteGrade, restore } = useStore.getState();
  const isNew = !initial.id;
  const [subjectId, setSubjectId] = useState(initial.subjectId);
  const [valueStr, setValueStr] = useState(initial.value !== undefined ? String(initial.value) : '');
  const [weightStr, setWeightStr] = useState(String(initial.weight ?? 1));
  const [title, setTitle] = useState(initial.title ?? '');
  const [date, setDate] = useState(initial.date ?? Date.now());
  const grades = useStore((s) => s.grades);
  const subjects = useSubjectList(true);
  useEffect(() => {
    if (!subjectId && subjects[0]) setSubjectId(subjects[0].id);
  }, [subjectId, subjects]);

  const value = parseGradeInput(valueStr);
  const weight = parseGradeInput(weightStr) ?? 1;
  const valid = value !== undefined && value >= 1 && value <= 6 && !!subjectId && weight >= 0;
  const others = grades.filter((g) => g.subjectId === subjectId && g.id !== initial.id);
  const before = weightedAverage(others);
  const after = valid ? weightedAverage([...others, { id: 'x', subjectId: subjectId!, value: value!, weight, title, date }]) : undefined;

  const save = () => {
    if (!valid) return;
    const data = { subjectId: subjectId!, value: value!, weight, title: title.trim() || 'Grade', date, source: initial.source ?? ('manual' as const) };
    if (isNew) addGrade(data);
    else updateGrade(initial.id!, data);
    toast(isNew ? `Grade ${formatGrade(value)} added` : 'Grade updated');
    onDone();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="sheet-head">
        <div className="grow headline-s">{isNew ? 'New grade' : 'Edit grade'}</div>
        {!isNew && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Delete"
            onClick={() => {
              const snap = useStore.getState().grades;
              deleteGrade(initial.id!);
              toast('Grade deleted', { label: 'Undo', run: () => restore({ grades: snap }) });
              onDone();
            }}
          >
            <Icon name="delete" />
          </button>
        )}
      </div>
      <div className="stack">
        <div className="row" style={{ alignItems: 'stretch' }}>
          <Field label="Grade (1–6)">
            <input className="input tnum" inputMode="decimal" autoFocus={isNew} style={{ height: 72, fontSize: 34, fontWeight: 760, textAlign: 'center' }} placeholder="5.5" value={valueStr} onChange={(e) => setValueStr(e.target.value)} />
          </Field>
          <motion.div layout transition={SPRING} style={{ display: 'grid', placeItems: 'center', paddingTop: 22 }}>
            <GradeChip value={value && value >= 1 && value <= 6 ? value : undefined} lg />
          </motion.div>
        </div>
        <div className="chips">
          {[3, 3.5, 4, 4.5, 5, 5.25, 5.5, 5.75, 6].map((v) => (
            <button type="button" key={v} className={'chip tnum' + (value === v ? ' selected' : '')} onClick={() => setValueStr(String(v))}>
              {formatGrade(v)}
            </button>
          ))}
        </div>
        <Field label="Subject">
          <SubjectSelect value={subjectId} onChange={setSubjectId} allowNone={false} />
        </Field>
        <Field label="Title">
          <input className="input" placeholder="e.g. Vocabulary test Unit 4" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="row">
          <Field label="Weight">
            <div className="row" style={{ gap: 8 }}>
              <input className="input tnum" inputMode="decimal" value={weightStr} onChange={(e) => setWeightStr(e.target.value)} style={{ width: 90, flex: 'none' }} />
              <div className="chips" style={{ flexWrap: 'nowrap' }}>
                {[0.5, 1, 2].map((w) => (
                  <button type="button" key={w} className={'chip' + (weight === w ? ' selected' : '')} onClick={() => setWeightStr(String(w))}>
                    ×{w}
                  </button>
                ))}
              </div>
            </div>
          </Field>
        </div>
        <Field label="Date">
          <input className="input" type="date" value={toInputDate(date)} onChange={(e) => e.target.value && setDate(fromInputs(e.target.value, '12:00'))} />
        </Field>
        {after !== undefined && (
          <div className="card flat row" style={{ padding: '14px 18px' }}>
            <Icon name="calculate" />
            <span className="grow body-m">
              Average {before !== undefined ? <>{formatGrade(before)} → </> : null}
              <b>{formatGrade(after)}</b>
            </span>
            {before !== undefined && <Icon name={after >= before ? 'trending_up' : 'trending_down'} style={{ color: after >= before ? 'var(--md-primary)' : 'var(--md-error)' }} />}
          </div>
        )}
      </div>
      <div className="sheet-actions">
        <button type="button" className="btn text" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn filled" disabled={!valid}>
          <Icon name="check" size={20} /> Save
        </button>
      </div>
    </form>
  );
}

/* =========================================================
   Local event editor
   ========================================================= */
function EventEditor({ initial, onDone }: { initial: Partial<CalEvent>; onDone: () => void }) {
  const { addLocalEvent, updateLocalEvent, deleteEvent, restore } = useStore.getState();
  const isNew = !initial.id;
  const defStart = initial.start ?? Math.ceil(Date.now() / HOUR) * HOUR;
  const [title, setTitle] = useState(initial.title ?? '');
  const [kind, setKind] = useState<'event' | 'test'>(initial.kind === 'test' ? 'test' : 'event');
  const [subjectId, setSubjectId] = useState(initial.subjectId);
  const [allDay, setAllDay] = useState(initial.allDay ?? false);
  const [start, setStart] = useState(defStart);
  const [end, setEnd] = useState(initial.end ?? defStart + HOUR);
  const [location, setLocation] = useState(initial.location ?? '');
  const [notes, setNotes] = useState(initial.description ?? '');

  const save = () => {
    const t = title.trim();
    if (!t) return;
    const s = allDay ? startOfDay(start) : start;
    const e = allDay ? startOfDay(end) + DAY : Math.max(end, start + 5 * 60_000);
    const data = { title: t, kind, subjectId, allDay, start: s, end: e, location: location.trim() || undefined, description: notes.trim() || undefined };
    if (isNew) addLocalEvent(data);
    else updateLocalEvent(initial.id!, data);
    toast(isNew ? 'Event created' : 'Event updated');
    onDone();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="sheet-head">
        <div className="grow headline-s">{isNew ? 'New event' : 'Edit event'}</div>
        {!isNew && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Delete"
            onClick={() => {
              const snap = useStore.getState().events;
              deleteEvent(initial.id!);
              toast('Event deleted', { label: 'Undo', run: () => restore({ events: snap }) });
              onDone();
            }}
          >
            <Icon name="delete" />
          </button>
        )}
      </div>
      <div className="stack">
        <input className="input" style={{ height: 60, fontSize: 18, fontWeight: 600 }} autoFocus={isNew} placeholder="Add title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Segmented
          layoutId="ev-kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'event', label: 'Event', icon: 'event' },
            { value: 'test', label: 'Test / exam', icon: 'quiz' },
          ]}
        />
        <Field label="Subject">
          <SubjectSelect value={subjectId} onChange={setSubjectId} />
        </Field>
        <label className="row label-l" style={{ cursor: 'pointer' }}>
          <Switch on={allDay} onChange={setAllDay} label="All day" /> All day
        </label>
        <div className="row">
          <Field label="Date">
            <input
              className="input"
              type="date"
              value={toInputDate(start)}
              onChange={(e) => {
                if (!e.target.value) return;
                const ns = fromInputs(e.target.value, toInputTime(start));
                setEnd(ns + (end - start));
                setStart(ns);
              }}
            />
          </Field>
        </div>
        {!allDay && (
          <div className="row">
            <Field label="Start">
              <input
                className="input"
                type="time"
                value={toInputTime(start)}
                onChange={(e) => {
                  const ns = fromInputs(toInputDate(start), e.target.value);
                  setEnd(ns + (end - start));
                  setStart(ns);
                }}
              />
            </Field>
            <Field label="End">
              <input className="input" type="time" value={toInputTime(end)} onChange={(e) => setEnd(fromInputs(toInputDate(start), e.target.value))} />
            </Field>
          </div>
        )}
        <Field label="Location">
          <input className="input" placeholder="Room" value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field label="Notes">
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <div className="sheet-actions">
        <button type="button" className="btn text" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn filled">
          <Icon name="check" size={20} /> Save
        </button>
      </div>
    </form>
  );
}

/* =========================================================
   Event details
   ========================================================= */
function EventDetails({ id }: { id: string }) {
  const ev = useStore((s) => s.events.find((e) => e.id === id));
  const sources = useStore((s) => s.sources);
  const tasks = useStore((s) => s.tasks);
  const codeIndex = useCodeIndex();
  const subjectId = ev ? eventSubjectId(ev, codeIndex) : undefined;
  const subject = useStore((s) => (subjectId ? s.subjects[subjectId] : undefined));
  const tones = useTones(subject?.color ?? ev?.color ?? '#7a7a7a');
  const { openTask, openEvent, close } = useEditors.getState();
  const toggleTask = useStore((s) => s.toggleTask);
  const linked = useMemo(() => tasks.filter((t) => t.eventId === id), [tasks, id]);

  if (!ev) return <div className="body-m muted">This event no longer exists.</div>;
  const source = sources.find((s) => s.id === ev.sourceId);
  const variant = variantLabel(ev.code);
  const isTest = ev.kind === 'test' || linked.some((t) => t.type === 'test');
  const heading = ev.kind === 'lesson' && subject ? subject.name : ev.title;

  return (
    <div>
      <div className="row" style={{ alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
        <Shape shape="cookie9" size={56} color={tones.container}>
          <Icon name={isTest ? 'quiz' : subjectIcon(subject)} style={{ color: tones.onContainer }} />
        </Shape>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="headline-s" style={{ wordBreak: 'break-word' }}>
            {heading}
          </div>
          <div className="body-m muted" style={{ marginTop: 2 }}>
            {fFull(ev.start)}
            {!ev.allDay && (
              <>
                {' · '}
                <span className="tnum">
                  {fTime(ev.start)}–{fTime(ev.end)}
                </span>
              </>
            )}
          </div>
          <div className="chips" style={{ marginTop: 10 }}>
            {isTest && <span className="badge error">Test</span>}
            {variant && <span className="badge outline">{variant}</span>}
            {ev.kind === 'lesson' && ev.title !== heading && <span className="badge outline">{ev.title}</span>}
          </div>
        </div>
      </div>

      <div className="list" style={{ marginBottom: 16 }}>
        {ev.location && (
          <div className="list-item">
            <Icon name="location_on" />
            <span className="grow">Room {ev.location}</span>
          </div>
        )}
        {ev.teacher && (
          <div className="list-item">
            <Icon name="person" />
            <span className="grow">
              {ev.teacher}
              {ev.classes?.length ? <span className="muted"> · Class {ev.classes.join(', ')}</span> : null}
            </span>
          </div>
        )}
        {ev.description && (
          <div className="list-item" style={{ alignItems: 'flex-start' }}>
            <Icon name="event_note" />
            <span className="grow body-m" style={{ whiteSpace: 'pre-wrap' }}>
              {ev.description}
            </span>
          </div>
        )}
        <div className="list-item">
          <Icon name="calendar_today" />
          <span className="grow muted body-m">{ev.sourceId === 'local' ? 'Created in Planner' : (source?.name ?? 'Calendar')}</span>
        </div>
      </div>

      {linked.length > 0 && (
        <div className="list" style={{ marginBottom: 16 }}>
          {linked.map((t) => (
            <div key={t.id} className="list-item clickable" onClick={() => (close('details'), openTask(t))}>
              <Check on={t.done} color={tones.accent} onToggle={() => toggleTask(t.id)} />
              <span className="grow" style={{ textDecoration: t.done ? 'line-through' : undefined }}>
                {t.title}
              </span>
              <span className="badge outline">{t.type === 'test' ? 'Test' : 'Homework'}</span>
            </div>
          ))}
        </div>
      )}

      <div className="chips">
        <button className="btn tonal" onClick={() => (close('details'), openTask({ subjectId, eventId: ev.id, due: ev.start, hasTime: !ev.allDay, type: 'homework' }))}>
          <Icon name="add_task" size={20} /> Homework
        </button>
        {!isTest && (
          <button
            className="btn tonal"
            onClick={() => {
              useStore.getState().addTask({ title: `Test${subject ? ' ' + subject.name : ''}`, type: 'test', subjectId, due: ev.start, hasTime: !ev.allDay, eventId: ev.id });
              toast('Marked as test — it now shows in Upcoming');
            }}
          >
            <Icon name="quiz" size={20} /> Mark as test
          </button>
        )}
        {subject && (
          <button className="btn outlined" onClick={() => (close('details'), navigate(`/subjects/${encodeURIComponent(subject.id)}`))}>
            <Icon name="school" size={20} /> {subject.short || subject.name}
          </button>
        )}
        {ev.sourceId === 'local' && (
          <button className="btn outlined" onClick={() => (close('details'), openEvent(ev))}>
            <Icon name="edit" size={20} /> Edit
          </button>
        )}
      </div>
      {ev.sourceId !== 'local' && <div className="body-s muted" style={{ marginTop: 14 }}>Synced from {source?.name ?? 'a calendar'} · last updated {source?.lastSync ? fDate(source.lastSync) + ' ' + fTime(source.lastSync) : 'never'}</div>}
    </div>
  );
}

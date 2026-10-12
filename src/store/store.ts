import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { del, get, set } from 'idb-keyval';
import { detectSubjects } from '../lib/subjects';
import type { CalEvent, CalendarSource, Grade, Settings, Subject, Task } from '../lib/types';

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: async (name, value) => set(name, value),
  removeItem: async (name) => del(name),
};

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  themeMode: 'system',
  seed: '#6750a4',
  glass: 0.7,
  weekends: 'auto',
  defaultView: 'week',
  passMark: 4,
  rounding: 0.5,
  showPlusPoints: true,
  reduceMotion: false,
  hiddenSubjects: [],
  hiddenSources: [],
  deskBurnInShift: true,
  onboarded: false,
};

export interface State {
  sources: CalendarSource[];
  events: CalEvent[];
  subjects: Record<string, Subject>;
  grades: Grade[];
  tasks: Task[];
  settings: Settings;

  addSource: (s: Omit<CalendarSource, 'id'>) => string;
  updateSource: (id: string, patch: Partial<CalendarSource>) => void;
  removeSource: (id: string) => void;
  setSourceEvents: (sourceId: string, events: CalEvent[]) => void;

  addLocalEvent: (e: Omit<CalEvent, 'id' | 'uid' | 'sourceId'>) => string;
  updateLocalEvent: (id: string, patch: Partial<CalEvent>) => void;
  deleteEvent: (id: string) => void;

  updateSubject: (id: string, patch: Partial<Subject>) => void;
  addSubject: (s: Omit<Subject, 'id' | 'codes' | 'counts'> & Partial<Subject>) => string;
  mergeSubject: (fromId: string, intoId: string) => void;
  moveCode: (code: string, toSubjectId: string) => void;
  deleteSubject: (id: string) => void;

  addGrade: (g: Omit<Grade, 'id'>) => string;
  updateGrade: (id: string, patch: Partial<Grade>) => void;
  deleteGrade: (id: string) => void;
  importGrades: (gs: Omit<Grade, 'id'>[]) => number;

  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'done'> & Partial<Task>) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  restore: (snapshot: Partial<Pick<State, 'grades' | 'tasks' | 'events' | 'subjects' | 'sources'>>) => void;

  setSettings: (patch: Partial<Settings>) => void;
  importBackup: (data: unknown) => void;
  resetAll: () => void;
}

const initial = {
  sources: [] as CalendarSource[],
  events: [] as CalEvent[],
  subjects: {} as Record<string, Subject>,
  grades: [] as Grade[],
  tasks: [] as Task[],
  settings: DEFAULT_SETTINGS,
};

export const useStore = create<State>()(
  persist(
    (setState, getState) => ({
      ...initial,

      addSource: (s) => {
        const id = uid();
        setState((st) => ({ sources: [...st.sources, { ...s, id }] }));
        return id;
      },
      updateSource: (id, patch) =>
        setState((st) => ({ sources: st.sources.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
      removeSource: (id) =>
        setState((st) => ({
          sources: st.sources.filter((s) => s.id !== id),
          events: st.events.filter((e) => e.sourceId !== id),
        })),
      setSourceEvents: (sourceId, events) =>
        setState((st) => {
          const others = st.events.filter((e) => e.sourceId !== sourceId);
          const subjects = detectSubjects(events, st.subjects);
          return {
            events: [...others, ...events].sort((a, b) => a.start - b.start),
            subjects,
            sources: st.sources.map((s) =>
              s.id === sourceId ? { ...s, lastSync: Date.now(), lastError: undefined, eventCount: events.length } : s,
            ),
          };
        }),

      addLocalEvent: (e) => {
        const id = 'local:' + uid();
        setState((st) => ({
          events: [...st.events, { ...e, id, uid: id, sourceId: 'local' }].sort((a, b) => a.start - b.start),
        }));
        return id;
      },
      updateLocalEvent: (id, patch) =>
        setState((st) => ({
          events: st.events.map((e) => (e.id === id ? { ...e, ...patch } : e)).sort((a, b) => a.start - b.start),
        })),
      deleteEvent: (id) => setState((st) => ({ events: st.events.filter((e) => e.id !== id) })),

      updateSubject: (id, patch) =>
        setState((st) => (st.subjects[id] ? { subjects: { ...st.subjects, [id]: { ...st.subjects[id], ...patch } } } : {})),
      addSubject: (s) => {
        const id = s.id ?? 'custom-' + uid().slice(0, 8);
        setState((st) => ({
          subjects: {
            ...st.subjects,
            [id]: { codes: [], counts: true, order: Object.keys(st.subjects).length, ...s, id },
          },
        }));
        return id;
      },
      mergeSubject: (fromId, intoId) =>
        setState((st) => {
          const from = st.subjects[fromId];
          const into = st.subjects[intoId];
          if (!from || !into || fromId === intoId) return {};
          const subjects = { ...st.subjects };
          subjects[intoId] = { ...into, codes: [...new Set([...into.codes, ...from.codes])] };
          delete subjects[fromId];
          return {
            subjects,
            grades: st.grades.map((g) => (g.subjectId === fromId ? { ...g, subjectId: intoId } : g)),
            tasks: st.tasks.map((t) => (t.subjectId === fromId ? { ...t, subjectId: intoId } : t)),
            events: st.events.map((e) => (e.subjectId === fromId ? { ...e, subjectId: intoId } : e)),
          };
        }),
      moveCode: (code, toSubjectId) =>
        setState((st) => {
          const subjects: Record<string, Subject> = {};
          for (const [k, s] of Object.entries(st.subjects)) {
            subjects[k] = s.codes.includes(code) ? { ...s, codes: s.codes.filter((c) => c !== code) } : s;
          }
          if (subjects[toSubjectId]) subjects[toSubjectId] = { ...subjects[toSubjectId], codes: [...subjects[toSubjectId].codes, code] };
          return { subjects };
        }),
      deleteSubject: (id) =>
        setState((st) => {
          const subjects = { ...st.subjects };
          delete subjects[id];
          return {
            subjects,
            grades: st.grades.filter((g) => g.subjectId !== id),
            tasks: st.tasks.map((t) => (t.subjectId === id ? { ...t, subjectId: undefined } : t)),
          };
        }),

      addGrade: (g) => {
        const id = uid();
        setState((st) => ({ grades: [...st.grades, { ...g, id }] }));
        return id;
      },
      updateGrade: (id, patch) => setState((st) => ({ grades: st.grades.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      deleteGrade: (id) => setState((st) => ({ grades: st.grades.filter((g) => g.id !== id) })),
      importGrades: (gs) => {
        const existing = new Set(getState().grades.map((g) => `${g.subjectId}|${g.date}|${g.title.toLowerCase()}|${g.value}`));
        const fresh = gs.filter((g) => !existing.has(`${g.subjectId}|${g.date}|${g.title.toLowerCase()}|${g.value}`));
        setState((st) => ({ grades: [...st.grades, ...fresh.map((g) => ({ ...g, id: uid() }))] }));
        return fresh.length;
      },

      addTask: (t) => {
        const id = uid();
        setState((st) => ({ tasks: [...st.tasks, { done: false, createdAt: Date.now(), ...t, id }] }));
        return id;
      },
      updateTask: (id, patch) => setState((st) => ({ tasks: st.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      toggleTask: (id) =>
        setState((st) => ({
          tasks: st.tasks.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: !t.done ? Date.now() : undefined } : t)),
        })),
      deleteTask: (id) => setState((st) => ({ tasks: st.tasks.filter((t) => t.id !== id) })),
      restore: (snapshot) => setState(snapshot),

      setSettings: (patch) => setState((st) => ({ settings: { ...st.settings, ...patch } })),
      importBackup: (data) => {
        const d = data as Partial<State> & { app?: string };
        if (!d || d.app !== 'student-planner') throw new Error('This is not a Student Planner backup file.');
        setState({
          sources: d.sources ?? [],
          events: d.events ?? [],
          subjects: d.subjects ?? {},
          grades: d.grades ?? [],
          tasks: d.tasks ?? [],
          settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
        });
      },
      resetAll: () => setState({ ...initial }),
    }),
    {
      name: 'student-planner',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        sources: s.sources,
        events: s.events,
        subjects: s.subjects,
        grades: s.grades,
        tasks: s.tasks,
        settings: s.settings,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) } };
      },
    },
  ),
);

export function exportBackup(): string {
  const s = useStore.getState();
  return JSON.stringify(
    {
      app: 'student-planner',
      version: 1,
      exportedAt: new Date().toISOString(),
      sources: s.sources,
      events: s.events.filter((e) => e.sourceId === 'local' || !s.sources.find((x) => x.id === e.sourceId)?.url),
      subjects: s.subjects,
      grades: s.grades,
      tasks: s.tasks,
      settings: s.settings,
    },
    null,
    1,
  );
}

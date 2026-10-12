export type SourceKind = 'school' | 'microsoft' | 'other';

export interface CalendarSource {
  id: string;
  name: string;
  kind: SourceKind;
  /** Remote feed (https / webcal). Absent for one-off file imports. */
  url?: string;
  fileName?: string;
  color: string;
  enabled: boolean;
  lastSync?: number;
  lastError?: string;
  eventCount?: number;
}

export type EventKind = 'lesson' | 'test' | 'event';

export interface CalEvent {
  id: string;
  sourceId: string; // 'local' for events created in the app
  uid: string;
  title: string; // raw SUMMARY
  start: number; // epoch ms
  end: number;
  allDay: boolean;
  location?: string;
  description?: string;
  kind: EventKind;
  /** Course code from the timetable (e.g. "E", "EH", "INH") — resolves to a subject. */
  code?: string;
  teacher?: string;
  classes?: string[];
  /** Explicit subject for app-created events. */
  subjectId?: string;
  color?: string;
}

export interface Subject {
  id: string;
  name: string;
  short: string;
  /** Timetable course codes that belong to this subject (e.g. ["E", "EH"]). */
  codes: string[];
  color: string;
  icon?: string;
  teacher?: string;
  hidden?: boolean;
  /** Counts towards overall average / plus points. */
  counts: boolean;
  target?: number;
  notes?: string;
  order?: number;
}

export interface Grade {
  id: string;
  subjectId: string;
  value: number;
  weight: number;
  title: string;
  date: number;
  source?: 'manual' | 'schulnetz';
}

export type TaskType = 'homework' | 'test' | 'reminder';

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  subjectId?: string;
  due: number; // epoch ms
  hasTime: boolean;
  done: boolean;
  doneAt?: number;
  notes?: string;
  eventId?: string;
  createdAt: number;
}

export type ThemeMode = 'system' | 'light' | 'dark';
export type CalView = 'day' | 'week' | 'month' | 'agenda';

export interface Settings {
  name: string;
  themeMode: ThemeMode;
  seed: string;
  glass: number; // 0..1
  weekends: 'auto' | 'always' | 'never';
  defaultView: CalView;
  passMark: number;
  rounding: number; // 0.5 for Swiss report grades
  showPlusPoints: boolean;
  reduceMotion: boolean;
  hiddenSubjects: string[];
  hiddenSources: string[];
  deskBurnInShift: boolean;
  onboarded: boolean;
}

export interface UpcomingItem {
  id: string;
  kind: 'task' | 'test';
  title: string;
  subjectId?: string;
  due: number;
  hasTime: boolean;
  task?: Task;
  event?: CalEvent;
}

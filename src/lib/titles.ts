import type { CalEvent, Subject } from './types';

const CODE_TOKEN = /\bf?[A-Za-z]{1,5}-\d+[a-z]+(?:,\d+[a-z]+)*-[A-Za-zÄÖÜäöü]{2,5}\b/;

/** Lessons show their subject name; tests like "Prüfung D-2e-FiB" become "Prüfung Deutsch". */
export function eventTitle(e: CalEvent & { subject?: Subject }): string {
  if (e.kind === 'lesson' && e.subject) return e.subject.name;
  if (e.subject && CODE_TOKEN.test(e.title)) return e.title.replace(CODE_TOKEN, e.subject.name).trim();
  return e.title;
}

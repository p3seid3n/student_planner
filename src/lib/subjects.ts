import type { CalEvent, EventKind, Subject } from './types';

/** Course codes used by Basel-Landschaft Gymnasien (Centerboard / schulNetz). */
export const KNOWN: Record<string, { name: string; short: string; icon: string }> = {
  D: { name: 'Deutsch', short: 'D', icon: 'menu_book' },
  E: { name: 'Englisch', short: 'E', icon: 'translate' },
  F: { name: 'Französisch', short: 'F', icon: 'translate' },
  I: { name: 'Italienisch', short: 'I', icon: 'translate' },
  S: { name: 'Spanisch', short: 'S', icon: 'translate' },
  L: { name: 'Latein', short: 'L', icon: 'history_edu' },
  GR: { name: 'Griechisch', short: 'Gr', icon: 'history_edu' },
  RU: { name: 'Russisch', short: 'Ru', icon: 'translate' },
  CN: { name: 'Chinesisch', short: 'Cn', icon: 'translate' },
  M: { name: 'Mathematik', short: 'M', icon: 'functions' },
  AM: { name: 'Anwendungen der Mathematik', short: 'AM', icon: 'calculate' },
  P: { name: 'Physik', short: 'P', icon: 'rocket_launch' },
  C: { name: 'Chemie', short: 'C', icon: 'science' },
  B: { name: 'Biologie', short: 'B', icon: 'eco' },
  G: { name: 'Geschichte', short: 'G', icon: 'history_edu' },
  PB: { name: 'Politische Bildung', short: 'PB', icon: 'account_balance' },
  GG: { name: 'Geografie', short: 'GG', icon: 'public' },
  ET: { name: 'Ethik', short: 'Et', icon: 'psychology' },
  RE: { name: 'Religion', short: 'Re', icon: 'psychology' },
  PH: { name: 'Philosophie', short: 'Ph', icon: 'psychology' },
  PP: { name: 'Philosophie / Psychologie', short: 'PP', icon: 'psychology' },
  WR: { name: 'Wirtschaft und Recht', short: 'WR', icon: 'payments' },
  W: { name: 'Wirtschaft', short: 'W', icon: 'payments' },
  IN: { name: 'Informatik', short: 'In', icon: 'computer' },
  BG: { name: 'Bildnerisches Gestalten', short: 'BG', icon: 'brush' },
  MU: { name: 'Musik', short: 'Mu', icon: 'music_note' },
  SP: { name: 'Sport', short: 'Sp', icon: 'sports_soccer' },
  TH: { name: 'Theater', short: 'Th', icon: 'theater_comedy' },
  KS: { name: 'Klassenstunde', short: 'KS', icon: 'groups' },
  MA: { name: 'Maturaarbeit', short: 'MA', icon: 'stars' },
};

/** Words that identify a test/exam in an event title. */
const TEST_RE =
  /(prüfung|pruefung|\bprüf\b|\btest\b|klausur|\bexam|lernkontrolle|\blk\b|probe|schriftlich|vokabeltest|vocab|quiz|vortrag|präsentation|abgabe|maturaprüfung)/i;

const COURSE_RE = /^(f?)([A-Za-zÄÖÜ]{1,5})-(\d+[a-zA-Z]+(?:,\s*\d+[a-zA-Z]+)*)-([A-Za-zÄÖÜäöü]{2,5})$/;
const COURSE_IN_TEXT_RE = /\b(f?[A-Z][A-Za-z]{0,4})-(\d+[a-z]+(?:,\d+[a-z]+)*)-([A-Z][a-zäöü]+[A-Z]?)\b/;
const FREIFACH_RE = /^f([A-Z]{1,5})$/;

export interface ParsedSummary {
  kind: EventKind;
  code?: string;
  teacher?: string;
  classes?: string[];
}

/** "E-2e-FiB" → lesson E, class 2e, teacher FiB. "fCR" → Freifach CR. Others → event/test. */
export function parseSummary(summary: string): ParsedSummary {
  const s = summary.trim();
  const isTest = TEST_RE.test(s);
  const m = s.match(COURSE_RE);
  if (m) {
    const code = (m[1] ? 'f' : '') + m[2].toUpperCase();
    return { kind: isTest ? 'test' : 'lesson', code, classes: m[3].split(/,\s*/), teacher: m[4] };
  }
  const f = s.match(FREIFACH_RE);
  if (f) return { kind: isTest ? 'test' : 'lesson', code: 'f' + f[1] };
  if (isTest) {
    const inner = s.match(COURSE_IN_TEXT_RE);
    if (inner) {
      const code = inner[1].startsWith('f') ? 'f' + inner[1].slice(1).toUpperCase() : inner[1].toUpperCase();
      return { kind: 'test', code, classes: inner[2].split(','), teacher: inner[3] };
    }
    const byName = guessCodeFromText(s);
    return { kind: 'test', code: byName };
  }
  return { kind: 'event' };
}

function guessCodeFromText(text: string): string | undefined {
  const t = text.toLowerCase();
  const aliases: [RegExp, string][] = [
    [/\bmathe|mathematik|\bmath\b/, 'M'],
    [/anwendungen der math/, 'AM'],
    [/deutsch/, 'D'],
    [/englisch|english/, 'E'],
    [/französisch|franz|french/, 'F'],
    [/italienisch/, 'I'],
    [/spanisch/, 'S'],
    [/latein/, 'L'],
    [/physik/, 'P'],
    [/chemie/, 'C'],
    [/biologie|\bbio\b/, 'B'],
    [/geschichte/, 'G'],
    [/geografie|geographie/, 'GG'],
    [/informatik/, 'IN'],
    [/musik/, 'MU'],
    [/sport/, 'SP'],
    [/wirtschaft/, 'WR'],
    [/ethik/, 'ET'],
    [/bildnerisch|\bbg\b/, 'BG'],
  ];
  for (const [re, code] of aliases) if (re.test(t)) return code;
  return undefined;
}

/** Google-Calendar-like defaults, tuned to stay distinct next to each other. */
export const SUBJECT_COLORS = [
  '#d50000', // tomato
  '#e67c73', // flamingo
  '#f4511e', // tangerine
  '#f6bf26', // banana
  '#33b679', // sage
  '#0b8043', // basil
  '#039be5', // peacock
  '#3f51b5', // blueberry
  '#7986cb', // lavender
  '#8e24aa', // grape
  '#616161', // graphite
  '#ad1457', // cherry
  '#00897b', // teal
  '#c0ca33', // avocado
  '#795548', // cocoa
  '#ef6c00', // pumpkin
];

const PREFERRED_COLOR: Record<string, string> = {
  M: '#3f51b5',
  AM: '#7986cb',
  D: '#d50000',
  E: '#039be5',
  F: '#8e24aa',
  G: '#795548',
  PB: '#ad1457',
  GG: '#0b8043',
  B: '#33b679',
  C: '#f4511e',
  P: '#ef6c00',
  IN: '#00897b',
  BG: '#e67c73',
  SP: '#f6bf26',
  ET: '#616161',
  MU: '#c0ca33',
};

interface Course {
  code: string;
  teacher?: string;
}

/**
 * Groups timetable course codes into subjects.
 * Variants like EH (Halbklasse), CP (Praktikum) or GL merge with the base subject
 * taught by the same teacher; existing user mappings always win.
 */
export function detectSubjects(events: CalEvent[], existing: Record<string, Subject>): Record<string, Subject> {
  const result: Record<string, Subject> = { ...existing };
  const mapped = new Map<string, string>();
  for (const s of Object.values(existing)) for (const c of s.codes) mapped.set(c, s.id);

  const courses = new Map<string, Course>();
  for (const e of events) {
    if (!e.code || courses.has(e.code)) continue;
    courses.set(e.code, { code: e.code, teacher: e.teacher });
  }
  const used = new Set(Object.values(result).map((s) => s.color));
  const pickColor = (code: string) => {
    const pref = PREFERRED_COLOR[code];
    if (pref && !used.has(pref)) return pref;
    const free = SUBJECT_COLORS.find((c) => !used.has(c));
    return free ?? SUBJECT_COLORS[used.size % SUBJECT_COLORS.length];
  };
  const ensure = (id: string, name: string, short: string, icon: string, teacher?: string) => {
    if (!result[id]) {
      const color = pickColor(id);
      used.add(color);
      result[id] = {
        id,
        name,
        short,
        icon,
        codes: [],
        color,
        teacher,
        counts: !['KS', 'MA'].includes(id) && !id.startsWith('f'),
        order: Object.keys(result).length,
      };
    }
    return result[id];
  };
  const attach = (subjectId: string, code: string) => {
    const s = result[subjectId];
    if (!s.codes.includes(code)) result[subjectId] = { ...s, codes: [...s.codes, code] };
    mapped.set(code, subjectId);
  };

  const all = [...courses.values()];
  // 1) known codes first so variants have something to merge into
  for (const c of all) {
    if (mapped.has(c.code)) continue;
    const k = KNOWN[c.code];
    if (k) {
      ensure(c.code, k.name, k.short, k.icon, c.teacher);
      attach(c.code, c.code);
    }
  }
  // 2) variants & unknown codes
  for (const c of all) {
    if (mapped.has(c.code)) continue;
    const code = c.code;
    if (code.startsWith('f')) {
      const id = code;
      ensure(id, `Freifach ${code.slice(1)}`, code.slice(1), 'star', c.teacher);
      attach(id, code);
      continue;
    }
    const stripped = code.replace(/[HPL]$/, '');
    const sameTeacherBase = all.find((o) => o.code === stripped && o.teacher && o.teacher === c.teacher);
    if (stripped !== code && sameTeacherBase && mapped.has(stripped)) {
      attach(mapped.get(stripped)!, code);
      continue;
    }
    const sibling = all.find(
      (o) => o.code !== code && o.teacher && o.teacher === c.teacher && o.code[0] === code[0] && mapped.has(o.code),
    );
    if (sibling) {
      attach(mapped.get(sibling.code)!, code);
      continue;
    }
    if (stripped !== code && KNOWN[stripped]) {
      const k = KNOWN[stripped];
      ensure(stripped, k.name, k.short, k.icon, c.teacher);
      attach(stripped, code);
      continue;
    }
    ensure(code, code, code.slice(0, 3), 'school', c.teacher);
    attach(code, code);
  }
  return result;
}

export function buildCodeIndex(subjects: Record<string, Subject>): Map<string, string> {
  const idx = new Map<string, string>();
  for (const s of Object.values(subjects)) for (const c of s.codes) idx.set(c, s.id);
  return idx;
}

export function eventSubjectId(e: CalEvent, codeIndex: Map<string, string>): string | undefined {
  if (e.subjectId) return e.subjectId;
  if (e.code) return codeIndex.get(e.code);
  return undefined;
}

export function subjectIcon(s?: Subject): string {
  if (!s) return 'event';
  return s.icon || KNOWN[s.id]?.icon || 'school';
}

export function variantLabel(code?: string): string | undefined {
  if (!code || KNOWN[code]) return undefined;
  if (/H$/.test(code) && code.length > 1) return 'Halbklasse';
  if (/P$/.test(code) && code.length > 1 && !KNOWN[code]) return 'Praktikum';
  return undefined;
}

import { KNOWN } from './subjects';
import type { Subject } from './types';

export interface ParsedGrade {
  key: string;
  subjectId?: string;
  subjectLabel: string;
  date: number;
  title: string;
  value: number;
  weight: number;
}

const DATE_RE = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/;
const COURSE_RE = /\b(f?[A-Za-z]{1,5})-(\d+[a-z]+(?:,\d+[a-z]+)*)-([A-Za-zÄÖÜäöü]{2,5})\b/;
const NUM_RE = /^-?\d+(?:[.,]\d+)?$/;
const HEADER_RE = /^(kurs|fach|datum|thema|bewertung|gewicht|note|noten|durchschnitt|details|schnitt|punkte)\b/i;

/**
 * Parses grades copied from schulNetz (portal.sbl.ch → Noten), either by
 * select-all + copy, via the bookmarklet, or as CSV "Fach;Datum;Titel;Note;Gewicht".
 * The parser is deliberately forgiving: it tracks the current course heading and
 * picks up every row that has a date and a grade between 1 and 6.
 */
export function parseGradesText(text: string, subjects: Record<string, Subject>, codeIndex: Map<string, string>): ParsedGrade[] {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/ /g, ' ').trim())
    .filter(Boolean);

  const nameIndex: [RegExp, string][] = [];
  for (const s of Object.values(subjects)) {
    nameIndex.push([new RegExp(`(^|\\s|\\t)${escapeRe(s.name)}(\\s|\\t|$)`, 'i'), s.id]);
  }
  for (const [code, k] of Object.entries(KNOWN)) {
    if (!subjects[code]) nameIndex.push([new RegExp(`(^|\\s|\\t)${escapeRe(k.name)}(\\s|\\t|$)`, 'i'), code]);
  }

  const out: ParsedGrade[] = [];
  let currentId: string | undefined;
  let currentLabel = '';

  for (const line of lines) {
    const csv = line.split(';').map((c) => c.trim());
    if (csv.length >= 4 && DATE_RE.test(csv[1]) && NUM_RE.test(csv[3].replace(',', '.'))) {
      const sid = resolveSubject(csv[0], subjects, codeIndex, nameIndex);
      const value = num(csv[3]);
      if (value !== undefined && value >= 1 && value <= 6) {
        out.push(mk(sid, csv[0], toDate(csv[1])!, csv[2] || 'Note', value, num(csv[4] ?? '') ?? 1));
      }
      continue;
    }

    const dateMatch = line.match(DATE_RE);
    const course = line.match(COURSE_RE);
    if (course && (!dateMatch || line.indexOf(course[0]) < line.indexOf(dateMatch[0]))) {
      const code = course[1].startsWith('f') ? course[1] : course[1].toUpperCase();
      currentId = codeIndex.get(code) ?? (KNOWN[code] ? code : codeIndex.get(code.replace(/[HPL]$/, '')));
      currentLabel = subjects[currentId ?? '']?.name ?? KNOWN[code]?.name ?? course[0];
      if (!dateMatch) continue;
    } else if (!dateMatch) {
      if (HEADER_RE.test(line) || line.length > 80) continue;
      let found = false;
      for (const [re, id] of nameIndex) {
        if (re.test(line)) {
          currentId = id;
          currentLabel = subjects[id]?.name ?? KNOWN[id]?.name ?? id;
          found = true;
          break;
        }
      }
      // An unrecognised short heading (e.g. "Chor") starts a new, unassigned group
      // so its grades are never filed under the previous subject.
      if (!found && /^[\p{L}][\p{L}\s./&()-]{1,40}$/u.test(line.split('\t')[0].trim())) {
        currentId = undefined;
        currentLabel = line.split('\t')[0].trim();
      }
      continue;
    }

    // A grade row: date, title, grade, (weight)
    const date = toDate(dateMatch![0]);
    if (!date) continue;
    const after = line.slice(line.indexOf(dateMatch![0]) + dateMatch![0].length);
    const cells = after.split(/\t+|\s{2,}/).map((c) => c.trim()).filter(Boolean);
    const tokens = cells.length > 1 ? cells : after.trim().split(/\s+/);
    const numericTail: number[] = [];
    while (tokens.length && NUM_RE.test(tokens[tokens.length - 1].replace(',', '.'))) {
      numericTail.unshift(num(tokens.pop()!)!);
    }
    let value: number | undefined;
    let weight = 1;
    const plausible = numericTail.filter((n) => n >= 1 && n <= 6);
    if (numericTail.length >= 2) {
      // [grade, weight] or [points, grade, weight]: take the last pair where the grade is in range
      for (let i = numericTail.length - 2; i >= 0; i--) {
        if (numericTail[i] >= 1 && numericTail[i] <= 6) {
          value = numericTail[i];
          weight = numericTail[i + 1];
          break;
        }
      }
    } else if (plausible.length === 1) {
      value = plausible[0];
    }
    if (value === undefined || !currentLabel) continue;
    if (!(weight >= 0 && weight <= 10)) weight = 1;
    const title = tokens.join(' ').replace(/\s+/g, ' ').trim() || 'Note';
    out.push(mk(currentId, currentLabel, date, title, value, weight));
  }
  // de-duplicate rows that appear twice (e.g. summary + detail tables)
  const seen = new Set<string>();
  return out.filter((g) => (seen.has(g.key) ? false : (seen.add(g.key), true)));
}

function mk(subjectId: string | undefined, label: string, date: number, title: string, value: number, weight: number): ParsedGrade {
  return {
    key: `${subjectId ?? label}|${date}|${title.toLowerCase()}|${value}`,
    subjectId,
    subjectLabel: label,
    date,
    title,
    value,
    weight,
  };
}

function resolveSubject(label: string, subjects: Record<string, Subject>, codeIndex: Map<string, string>, nameIndex: [RegExp, string][]) {
  const course = label.match(COURSE_RE);
  if (course) return codeIndex.get(course[1].toUpperCase());
  const direct = codeIndex.get(label.toUpperCase()) ?? (subjects[label.toUpperCase()] ? label.toUpperCase() : undefined);
  if (direct) return direct;
  for (const [re, id] of nameIndex) if (re.test(label)) return id;
  return undefined;
}

function num(s: string): number | undefined {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : undefined;
}

function toDate(s: string): number | undefined {
  const m = s.match(DATE_RE);
  if (!m) return undefined;
  let y = +m[3];
  if (y < 100) y += 2000;
  const d = new Date(y, +m[2] - 1, +m[1], 12);
  return Number.isNaN(+d) ? undefined : +d;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Bookmarklet for the schulNetz "Noten" page. It reads every table row —
 * including the collapsed detail rows — and opens the planner's import screen.
 */
export function bookmarklet(appOrigin: string): string {
  const code = `(()=>{const rows=[...document.querySelectorAll('tr')].map(r=>[...r.children].map(c=>(c.textContent||'').replace(/\\s+/g,' ').trim()).filter(Boolean).join('\\t')).filter(Boolean);const t=rows.join('\\n');try{navigator.clipboard.writeText(t)}catch(e){}const w=window.open('${appOrigin}/import#'+encodeURIComponent(t),'_blank');if(!w)alert('Grades copied — paste them into Student Planner → Import grades.')})()`;
  return 'javascript:' + encodeURI(code).replace(/#/g, '%23');
}

import type { Grade, Subject } from './types';

export function weightedAverage(grades: Grade[]): number | undefined {
  let sum = 0;
  let w = 0;
  for (const g of grades) {
    if (!(g.weight > 0)) continue;
    sum += g.value * g.weight;
    w += g.weight;
  }
  return w > 0 ? sum / w : undefined;
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Grade needed on the next assessment (with `weight`) to land exactly on `target`. */
export function requiredGrade(grades: Grade[], target: number, weight: number): number | undefined {
  if (!(weight > 0)) return undefined;
  let sum = 0;
  let w = 0;
  for (const g of grades) {
    if (!(g.weight > 0)) continue;
    sum += g.value * g.weight;
    w += g.weight;
  }
  return (target * (w + weight) - sum) / weight;
}

/**
 * Swiss "Pluspunkte": every report grade (rounded to halves) above 4 adds the
 * difference, every grade below 4 subtracts double the difference.
 */
export function plusPoints(averages: number[], passMark = 4, step = 0.5): { points: number; insufficient: number } {
  let points = 0;
  let insufficient = 0;
  for (const a of averages) {
    const r = roundTo(a, step);
    if (r >= passMark) points += r - passMark;
    else {
      points -= 2 * (passMark - r);
      insufficient++;
    }
  }
  return { points, insufficient };
}

export function formatGrade(v: number | undefined, digits = 2): string {
  if (v === undefined || Number.isNaN(v)) return '–';
  const s = v.toFixed(digits);
  return digits > 1 ? s.replace(/0$/, '') : s;
}

export function parseGradeInput(s: string): number | undefined {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : undefined;
}

/** Semesters follow the Swiss school year: autumn (Aug–Jan) and spring (Feb–Jul). */
export function semesterOf(ts: number): { key: string; label: string; start: number; end: number } {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = d.getMonth();
  if (m >= 7) {
    return { key: `${y}-HS`, label: `HS ${y}/${String(y + 1).slice(2)}`, start: +new Date(y, 7, 1), end: +new Date(y + 1, 1, 1) };
  }
  if (m === 0) {
    return { key: `${y - 1}-HS`, label: `HS ${y - 1}/${String(y).slice(2)}`, start: +new Date(y - 1, 7, 1), end: +new Date(y, 1, 1) };
  }
  return { key: `${y}-FS`, label: `FS ${y}`, start: +new Date(y, 1, 1), end: +new Date(y, 7, 1) };
}

export function gradesForSubject(grades: Grade[], subjectId: string, semesterKey?: string): Grade[] {
  return grades
    .filter((g) => g.subjectId === subjectId && (!semesterKey || semesterOf(g.date).key === semesterKey))
    .sort((a, b) => a.date - b.date);
}

export interface SubjectStats {
  subject: Subject;
  grades: Grade[];
  average?: number;
  rounded?: number;
  trend: number; // last grade vs previous average
}

export function subjectStats(subject: Subject, grades: Grade[], semesterKey: string | undefined, step: number): SubjectStats {
  const gs = gradesForSubject(grades, subject.id, semesterKey);
  const average = weightedAverage(gs);
  const prev = weightedAverage(gs.slice(0, -1));
  return {
    subject,
    grades: gs,
    average,
    rounded: average !== undefined ? roundTo(average, step) : undefined,
    trend: average !== undefined && prev !== undefined ? average - prev : 0,
  };
}

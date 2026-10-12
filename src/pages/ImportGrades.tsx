import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store/store';
import { useCodeIndex, useSubjectList } from '../store/hooks';
import { bookmarklet, parseGradesText, type ParsedGrade } from '../lib/schulnetz';
import { fDate } from '../lib/dates';
import { formatGrade } from '../lib/grades';
import { back, navigate } from '../router';
import { Check, GradeChip, Icon, SPRING, toast } from '../components/ui';

export default function ImportGrades() {
  const subjects = useStore((s) => s.subjects);
  const list = useSubjectList(true);
  const codeIndex = useCodeIndex();
  const [text, setText] = useState('');
  const [rows, setRows] = useState<(ParsedGrade & { on: boolean })[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const existing = useStore((s) => s.grades);

  // Data handed over by the bookmarklet arrives in the URL hash.
  useEffect(() => {
    if (location.hash.length > 1) {
      try {
        setText(decodeURIComponent(location.hash.slice(1)));
      } catch {
        /* ignore */
      }
      history.replaceState(history.state, '', location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!text.trim()) {
      setRows([]);
      return;
    }
    const known = new Set(existing.map((g) => `${g.subjectId}|${g.date}|${g.title.toLowerCase()}|${g.value}`));
    const parsed = parseGradesText(text, subjects, codeIndex);
    setRows(parsed.map((p) => ({ ...p, on: !known.has(`${p.subjectId}|${p.date}|${p.title.toLowerCase()}|${p.value}`) })));
  }, [text, subjects, codeIndex, existing]);

  const labels = useMemo(() => [...new Set(rows.filter((r) => !r.subjectId).map((r) => r.subjectLabel))], [rows]);
  const selected = rows.filter((r) => r.on && (r.subjectId || overrides[r.subjectLabel]));
  const bm = bookmarklet(location.origin);

  const doImport = () => {
    const n = useStore.getState().importGrades(
      selected.map((r) => ({ subjectId: r.subjectId ?? overrides[r.subjectLabel], value: r.value, weight: r.weight, title: r.title, date: r.date, source: 'schulnetz' as const })),
    );
    toast(n ? `Imported ${n} grade${n > 1 ? 's' : ''}` : 'Those grades were already imported');
    navigate('/subjects');
  };

  return (
    <div className="page-inner" style={{ maxWidth: 920 }}>
      <header className="topbar">
        <button className="icon-btn tonal" aria-label="Back" onClick={() => back('/settings')}>
          <Icon name="arrow_back" />
        </button>
        <h1 className="headline-l grow" style={{ margin: 0 }}>
          Import grades
        </h1>
      </header>

      <section className="card">
        <div className="title-l" style={{ marginBottom: 10 }}>
          From schulNetz (portal.sbl.ch)
        </div>
        <ol className="body-m steps">
          <li>
            Open{' '}
            <a href="https://portal.sbl.ch/gymow/" target="_blank" rel="noreferrer">
              portal.sbl.ch <Icon name="open_in_new" size={14} style={{ verticalAlign: -2 }} />
            </a>{' '}
            and log in, then go to <b>Noten</b>.
          </li>
          <li>
            <b>Desktop:</b> drag this button to your bookmarks bar once, then click it on the Noten page —{' '}
            <a className="btn tonal sm" ref={(el) => el?.setAttribute('href', bm)} onClick={(e) => (e.preventDefault(), toast('Drag this button to your bookmarks bar'))} draggable>
              <Icon name="bookmark" size={18} /> Grades → Planner
            </a>
          </li>
          <li>
            <b>Or anywhere:</b> select all on the Noten page (open the details of each course first), copy, and paste below.
          </li>
        </ol>
        <textarea className="input" style={{ minHeight: 140, fontFamily: 'ui-monospace, monospace', fontSize: 13 }} placeholder={'E-2e-FiB  Englisch  4.875\n15.09.2026  Vocabulary Unit 3  5.25  0.5\n…\n\nor CSV:  Fach;Datum;Titel;Note;Gewicht'} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row" style={{ marginTop: 10 }}>
          <button
            className="btn outlined sm"
            onClick={async () => {
              try {
                setText(await navigator.clipboard.readText());
              } catch {
                toast('Clipboard access was blocked — paste manually');
              }
            }}
          >
            <Icon name="content_paste" size={18} /> Paste from clipboard
          </button>
          {text && (
            <button className="btn text sm" onClick={() => setText('')}>
              Clear
            </button>
          )}
        </div>
      </section>

      {text.trim() && (
        <motion.section className="card" style={{ marginTop: 14 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
          <div className="card-head">
            <div className="grow title-l">{rows.length ? `${rows.length} grades found` : 'No grades recognised yet'}</div>
            {rows.length > 0 && (
              <button className="btn text sm" onClick={() => setRows(rows.map((r) => ({ ...r, on: !rows.every((x) => x.on) })))}>
                Toggle all
              </button>
            )}
          </div>
          {!rows.length && <div className="body-m muted">Each grade line needs a date (dd.mm.yyyy) and a grade between 1 and 6, below a course heading such as “E-2e-FiB” or “Englisch”.</div>}
          {labels.length > 0 && (
            <div className="stack" style={{ marginBottom: 16 }}>
              {labels.map((l) => (
                <div key={l} className="row">
                  <span className="body-m grow">
                    Assign <b>{l}</b> to
                  </span>
                  <select className="input" style={{ width: 220 }} value={overrides[l] ?? ''} onChange={(e) => setOverrides({ ...overrides, [l]: e.target.value })}>
                    <option value="">Skip</option>
                    {list.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
          <div className="list">
            {rows.map((r, i) => (
              <div key={r.key} className="list-item clickable" onClick={() => setRows(rows.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} style={{ opacity: r.on ? 1 : 0.5 }}>
                <Check on={r.on} onToggle={() => setRows(rows.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} />
                <GradeChip value={r.value} />
                <div className="grow">
                  <div className="title-s ellipsis">{r.title}</div>
                  <div className="body-s muted">
                    {subjects[r.subjectId ?? overrides[r.subjectLabel] ?? '']?.name ?? r.subjectLabel} · {fDate(r.date)} · ×{formatGrade(r.weight)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {rows.length > 0 && (
            <div className="sheet-actions">
              <button className="btn filled lg" disabled={!selected.length} onClick={doImport}>
                <Icon name="download" /> Import {selected.length}
              </button>
            </div>
          )}
        </motion.section>
      )}
    </div>
  );
}

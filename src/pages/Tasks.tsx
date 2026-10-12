import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../store/store';
import { useSubjectList, useUpcoming } from '../store/hooks';
import { useEditors } from '../components/editors';
import { UpcomingList, UpcomingRow } from '../components/items';
import { Empty, Icon, Segmented, SPRING, toast } from '../components/ui';
import type { UpcomingItem } from '../lib/types';

type Filter = 'all' | 'homework' | 'test' | 'reminder';

export default function Tasks() {
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const [filter, setFilter] = useState<Filter>('all');
  const [subject, setSubject] = useState<string>('');
  const upcoming = useUpcoming(3650);
  const tasks = useStore((s) => s.tasks);
  const subjects = useSubjectList(true);
  const { openTask } = useEditors.getState();

  const match = (i: UpcomingItem) =>
    (filter === 'all' || (filter === 'test' ? i.kind === 'test' : i.task?.type === filter)) && (!subject || i.subjectId === subject);

  const open = upcoming.filter(match);
  const done = useMemo(
    () =>
      tasks
        .filter((t) => t.done)
        .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))
        .map<UpcomingItem>((t) => ({ id: t.id, kind: t.type === 'test' ? 'test' : 'task', title: t.title, subjectId: t.subjectId, due: t.due, hasTime: t.hasTime, task: t }))
        .filter(match),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, filter, subject],
  );

  return (
    <div className="page-inner" style={{ maxWidth: 880 }}>
      <header className="topbar">
        <h1 className="display-m grow" style={{ margin: 0 }}>
          Tasks
        </h1>
        <button className="btn filled" onClick={() => openTask({ type: filter === 'test' ? 'test' : filter === 'reminder' ? 'reminder' : 'homework', subjectId: subject || undefined })}>
          <Icon name="add" size={20} /> New
        </button>
      </header>
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 18 }}>
        <Segmented
          layoutId="tasks-tab"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'open', label: `Open · ${upcoming.length}` },
            { value: 'done', label: 'Done' },
          ]}
        />
        <div className="grow" />
        <select className="input" style={{ width: 'auto', height: 44 }} value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Filter by subject">
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="chips" style={{ marginBottom: 20 }}>
        {(
          [
            ['all', 'All', 'apps'],
            ['homework', 'Homework', 'assignment'],
            ['test', 'Tests', 'quiz'],
            ['reminder', 'Reminders', 'notifications'],
          ] as const
        ).map(([v, l, ic]) => (
          <button key={v} className={'chip' + (filter === v ? ' selected' : '')} onClick={() => setFilter(v)}>
            <Icon name={filter === v ? 'check' : ic} size={18} /> {l}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={SPRING}>
          {tab === 'open' ? (
            open.length ? (
              <UpcomingList items={open} />
            ) : (
              <Empty icon="task_alt" title="Nothing to do" text="Enjoy it — or plan ahead by adding homework and tests." action={<button className="btn tonal" onClick={() => openTask({})}>Add task</button>} />
            )
          ) : done.length ? (
            <>
              <div className="list">
                <AnimatePresence initial={false}>
                  {done.slice(0, 100).map((i) => (
                    <UpcomingRow key={i.id} item={i} />
                  ))}
                </AnimatePresence>
              </div>
              <button
                className="btn text"
                style={{ marginTop: 14 }}
                onClick={() => {
                  const snap = useStore.getState().tasks;
                  useStore.setState({ tasks: snap.filter((t) => !t.done) });
                  toast('Cleared completed tasks', { label: 'Undo', run: () => useStore.getState().restore({ tasks: snap }) });
                }}
              >
                <Icon name="delete" size={18} /> Clear completed
              </button>
            </>
          ) : (
            <Empty icon="done_all" title="No completed tasks yet" />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

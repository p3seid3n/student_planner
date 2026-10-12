import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../store/store';
import { daysUntil, fTime, relativeDay, startOfDay, DAY } from '../lib/dates';
import { subjectIcon } from '../lib/subjects';
import type { Subject, UpcomingItem } from '../lib/types';
import type { ResolvedEvent } from '../store/hooks';
import { eventTitle } from '../lib/titles';
import { useEditors } from './editors';
import { Check, Icon, Shape, SPRING, toast, useTones } from './ui';

export function UpcomingRow({ item, compact }: { item: UpcomingItem; compact?: boolean }) {
  const subject = useStore((s) => (item.subjectId ? s.subjects[item.subjectId] : undefined));
  const toggle = useStore((s) => s.toggleTask);
  const tones = useTones(subject?.color ?? '#7a7a7a');
  const { openTask, openDetails } = useEditors.getState();
  const d = daysUntil(item.due);
  const overdue = item.due < Date.now() && (item.hasTime || d < 0);
  const isTest = item.kind === 'test';
  const done = item.task?.done ?? false;

  const open = () => (item.task ? openTask(item.task) : item.event && openDetails(item.event.id));

  return (
    <motion.div layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }} transition={SPRING}>
      <div className="list-item clickable" onClick={open} style={{ minHeight: compact ? 56 : 64 }}>
        {item.task ? (
          <Check
            on={done}
            color={tones.accent}
            onToggle={() => {
              toggle(item.task!.id);
              if (!done) toast(`Done: ${item.title}`, { label: 'Undo', run: () => toggle(item.task!.id) });
            }}
          />
        ) : (
          <Shape shape="clover" size={30} color={tones.container}>
            <Icon name="quiz" size={16} style={{ color: tones.onContainer }} />
          </Shape>
        )}
        <div className="grow">
          <div className="title-s ellipsis" style={{ textDecoration: done ? 'line-through' : undefined }}>
            {item.title}
          </div>
          <div className="body-s muted row" style={{ gap: 6, marginTop: 2 }}>
            {subject && (
              <>
                <span className="subject-dot" style={{ background: tones.accent, width: 8, height: 8 }} />
                <span className="ellipsis">{subject.name}</span>
                <span>·</span>
              </>
            )}
            <span className="tnum" style={{ color: overdue ? 'var(--md-error)' : undefined, whiteSpace: 'nowrap' }}>
              {relativeDay(item.due)}
              {item.hasTime ? ' ' + fTime(item.due) : ''}
            </span>
          </div>
        </div>
        {isTest ? (
          <span className={'badge' + (d <= 2 ? ' error' : '')}>{d <= 0 ? 'Test today' : d === 1 ? 'Test tomorrow' : `Test in ${d} d`}</span>
        ) : overdue ? (
          <span className="badge error">Overdue</span>
        ) : null}
      </div>
    </motion.div>
  );
}

const GROUPS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week', label: 'This week' },
  { key: 'later', label: 'Later' },
] as const;

function groupOf(due: number, hasTime: boolean): (typeof GROUPS)[number]['key'] {
  const now = Date.now();
  const today = startOfDay(now);
  if ((hasTime && due < now) || due < today) return 'overdue';
  if (due < today + DAY) return 'today';
  if (due < today + 2 * DAY) return 'tomorrow';
  if (due < today + 7 * DAY) return 'week';
  return 'later';
}

export function UpcomingList({ items, grouped = true, limit }: { items: UpcomingItem[]; grouped?: boolean; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  if (!grouped) {
    return (
      <div className="list">
        <AnimatePresence initial={false}>
          {shown.map((i) => (
            <UpcomingRow key={i.id} item={i} compact />
          ))}
        </AnimatePresence>
      </div>
    );
  }
  const byGroup = new Map<string, UpcomingItem[]>();
  for (const i of shown) {
    const g = groupOf(i.due, i.hasTime);
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(i);
  }
  return (
    <div className="stack" style={{ gap: 18 }}>
      {GROUPS.filter((g) => byGroup.has(g.key)).map((g) => (
        <div key={g.key}>
          <div className="label-m upper muted" style={{ margin: '0 6px 8px', color: g.key === 'overdue' ? 'var(--md-error)' : undefined }}>
            {g.label}
          </div>
          <div className="list">
            <AnimatePresence initial={false}>
              {byGroup.get(g.key)!.map((i) => (
                <UpcomingRow key={i.id} item={i} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LessonRow({ e, now, onClick }: { e: ResolvedEvent; now: number; onClick?: () => void }) {
  const tones = useTones(e.subject?.color ?? e.color ?? '#7a7a7a');
  const live = now >= e.start && now < e.end;
  const past = now >= e.end;
  return (
    <button className="list-item" onClick={onClick} style={{ opacity: past ? 0.55 : 1, background: live ? tones.container : undefined, color: live ? tones.onContainer : undefined }}>
      <div className="tnum label-l" style={{ width: 50, textAlign: 'right', flex: 'none' }}>
        <div>{e.allDay ? 'All day' : fTime(e.start)}</div>
        {!e.allDay && <div className="body-s" style={{ opacity: 0.7 }}>{fTime(e.end)}</div>}
      </div>
      <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: tones.accent, flex: 'none' }} />
      <div className="grow">
        <div className="title-s ellipsis">{eventTitle(e)}</div>
        <div className="body-s ellipsis" style={{ opacity: 0.75 }}>
          {[e.location && `Room ${e.location}`, e.teacher].filter(Boolean).join(' · ') || (e.kind === 'event' ? 'Event' : '')}
        </div>
      </div>
      {e.kind === 'test' && <span className="badge error">Test</span>}
      {live && <span className="badge" style={{ background: tones.accent, color: tones.onAccent }}>Now</span>}
    </button>
  );
}

export { eventTitle };

export function SubjectAvatar({ subject, size = 44, strong }: { subject?: Subject; size?: number; strong?: boolean }) {
  const t = useTones(subject?.color ?? '#7a7a7a');
  return (
    <Shape shape="cookie9" size={size} color={strong ? t.accent : t.container}>
      <Icon name={subjectIcon(subject)} size={Math.round(size * 0.48)} style={{ color: strong ? t.onAccent : t.onContainer }} />
    </Shape>
  );
}

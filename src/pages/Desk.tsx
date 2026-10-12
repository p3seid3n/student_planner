import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../store/store';
import { useEventsByDay, useNow, useUpcoming } from '../store/hooks';
import { daysUntil, dayKey, durationLabel, fFull, fTime, relativeDay } from '../lib/dates';
import { back } from '../router';
import { eventTitle, SubjectAvatar } from '../components/items';
import { Icon, Shape, SPRING, useTones, WavyRing } from '../components/ui';
import { useSchoolDay } from './Home';
import type { UpcomingItem } from '../lib/types';

export default function Desk() {
  const now = useNow(1_000);
  const day = useSchoolDay(now);
  const upcoming = useUpcoming(14);
  const shiftOn = useStore((s) => s.settings.deskBurnInShift);
  const [controls, setControls] = useState(true);
  const [full, setFull] = useState(!!document.fullscreenElement);

  // keep the screen awake
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    const req = async () => {
      try {
        lock = await navigator.wakeLock?.request('screen');
      } catch {
        /* not supported / denied */
      }
    };
    req();
    const vis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      lock?.release().catch(() => {});
    };
  }, []);

  // auto-hide controls & cursor
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => {
      setControls(true);
      clearTimeout(t);
      t = setTimeout(() => setControls(false), 3000);
    };
    wake();
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    const fs = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fs);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && !document.fullscreenElement && back('/');
    window.addEventListener('keydown', key);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      document.removeEventListener('fullscreenchange', fs);
      window.removeEventListener('keydown', key);
    };
  }, []);

  // burn-in protection: drift a few px every 3 minutes
  const slot = Math.floor(now / 180_000);
  const shift = shiftOn ? { x: ((slot * 7) % 9) - 4, y: ((slot * 5) % 7) - 3 } : { x: 0, y: 0 };

  const d = new Date(now);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');

  return (
    <div className={'desk' + (controls ? '' : ' idle')}>
      <motion.div className="desk-grid" animate={{ x: shift.x, y: shift.y }} transition={{ duration: 4, ease: 'easeInOut' }}>
        <section className="desk-clock">
          <div className="desk-time tnum">
            {hh}
            <span className="desk-colon">:</span>
            {mm}
          </div>
          <div className="desk-date">{fFull(now)}</div>
        </section>

        <section className="desk-now">
          <NowPanel day={day} now={now} />
        </section>

        <section className="desk-up">
          <div className="desk-label">Upcoming</div>
          {upcoming.length ? (
            <div className="desk-list">
              {upcoming.slice(0, 6).map((u) => (
                <DeskItem key={u.id} u={u} now={now} />
              ))}
            </div>
          ) : (
            <div className="desk-empty">
              <Icon name="celebration" size={28} /> Nothing due in the next two weeks
            </div>
          )}
        </section>

        <section className="desk-timeline">
          <Timeline now={now} />
        </section>
      </motion.div>

      <AnimatePresence>
        {controls && (
          <motion.div className="desk-controls glass" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={SPRING}>
            <button className="icon-btn" aria-label="Back" onClick={() => back('/')}>
              <Icon name="arrow_back" />
            </button>
            <button
              className="icon-btn"
              aria-label={full ? 'Exit full screen' : 'Full screen'}
              onClick={() => (full ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}))}
            >
              <Icon name={full ? 'fullscreen_exit' : 'fullscreen'} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NowPanel({ day, now }: { day: ReturnType<typeof useSchoolDay>; now: number }) {
  const focus = day.current ?? day.next;
  const tones = useTones(focus?.subject?.color ?? '#6750a4');
  const after = day.current ? day.events.find((e) => !e.allDay && e.start >= day.current!.end) : undefined;
  if (!focus) {
    return (
      <div className="desk-card" style={{ background: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)' }}>
        <Shape shape="sunny" size={110} color="var(--md-primary)" spin={30}>
          <Icon name={day.done ? 'celebration' : 'wb_sunny'} size={50} style={{ color: 'var(--md-on-primary)' }} />
        </Shape>
        <div className="desk-big">{day.done ? 'Done for today' : 'Free day'}</div>
      </div>
    );
  }
  const progress = day.current ? (now - day.current.start) / (day.current.end - day.current.start) : 0;
  const until = focus.start - now;
  return (
    <AnimatePresence mode="wait">
      <motion.div key={focus.id} className="desk-card" style={{ background: tones.container, color: tones.onContainer }} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={SPRING}>
        <div className="desk-card-row">
          {day.current ? (
            <WavyRing className="desk-ring" value={progress} size={160} stroke={16} color={tones.accent} track={`color-mix(in srgb, ${tones.onContainer} 16%, transparent)`}>
              <div style={{ textAlign: 'center' }}>
                <div className="desk-mid tnum">{Math.max(0, Math.ceil((day.current.end - now) / 60_000))}</div>
                <div className="desk-small">min left</div>
              </div>
            </WavyRing>
          ) : (
            <SubjectAvatar subject={focus.subject} size={120} strong />
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="desk-small upper" style={{ opacity: 0.8 }}>
              {day.current ? 'Now' : day.label === 'Today' ? `Next · in ${durationLabel(until)}` : `Next · ${day.label}`}
            </div>
            <div className="desk-big" lang="de">{eventTitle(focus)}</div>
            <div className="desk-meta tnum">
              {fTime(focus.start)}–{fTime(focus.end)}
              {focus.location && <> · Room {focus.location}</>}
            </div>
          </div>
        </div>
        {after && (
          <div className="desk-after">
            <Icon name="arrow_forward" size={20} />
            <span className="ellipsis">
              {eventTitle(after)} · {fTime(after.start)}
              {after.location ? ` · ${after.location}` : ''}
            </span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function DeskItem({ u, now }: { u: UpcomingItem; now: number }) {
  const subject = useStore((s) => (u.subjectId ? s.subjects[u.subjectId] : undefined));
  const t = useTones(subject?.color ?? '#7a7a7a');
  const dd = daysUntil(u.due, now);
  return (
    <div className="desk-item">
      <span className="desk-item-bar" style={{ background: t.accent }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="desk-item-title ellipsis">
          {u.kind === 'test' && <Icon name="quiz" size={18} style={{ verticalAlign: -3, marginRight: 4, color: t.accent }} />}
          {u.title}
        </div>
        <div className="desk-small ellipsis">
          {subject?.name ?? (u.kind === 'test' ? 'Test' : 'Task')} · {relativeDay(u.due, now)}
        </div>
      </div>
      {u.kind === 'test' && <span className={'badge' + (dd <= 2 ? ' error' : '')}>{dd <= 0 ? 'today' : `${dd} d`}</span>}
    </div>
  );
}

function Timeline({ now }: { now: number }) {
  const byDay = useEventsByDay();
  const events = useMemo(() => (byDay.get(dayKey(now)) ?? []).filter((e) => !e.allDay), [byDay, now]);
  if (!events.length) return null;
  const s = Math.min(...events.map((e) => e.start));
  const en = Math.max(...events.map((e) => e.end));
  const span = en - s;
  const pos = (t: number) => `${((t - s) / span) * 100}%`;
  return (
    <div className="tl">
      {events.map((e) => (
        <TimelineBlock key={e.id} left={pos(e.start)} width={`calc(${((e.end - e.start) / span) * 100}% - 3px)`} color={e.subject?.color ?? e.color ?? '#888'} label={e.subject?.short || eventTitle(e)} past={e.end < now} live={now >= e.start && now < e.end} />
      ))}
      {now >= s && now <= en && <div className="tl-now" style={{ left: pos(now) }} />}
      <span className="tl-time tnum" style={{ left: 0 }}>
        {fTime(s)}
      </span>
      <span className="tl-time tnum" style={{ right: 0 }}>
        {fTime(en)}
      </span>
    </div>
  );
}

function TimelineBlock({ left, width, color, label, past, live }: { left: string; width: string; color: string; label: string; past: boolean; live: boolean }) {
  const t = useTones(color);
  return (
    <div className="tl-block" style={{ left, width, background: live ? t.accent : t.container, color: live ? t.onAccent : t.onContainer, opacity: past ? 0.6 : 1 }}>
      <span className="ellipsis">{label}</span>
    </div>
  );
}

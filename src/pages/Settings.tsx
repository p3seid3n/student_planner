import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { exportBackup, useStore } from '../store/store';
import { syncAll } from '../lib/sync';
import { navigate } from '../router';
import { AddSourceForm, SourceRow, useSyncBusy } from '../components/sources';
import { Field, Icon, Segmented, SPRING, Switch, toast } from '../components/ui';
import { SEED_PRESETS } from '../theme/theme';
import type { CalView, ThemeMode } from '../lib/types';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferredPrompt: BIPEvent | undefined;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as BIPEvent;
});

function Section({ icon, title, children, id }: { icon: string; title: string; children: ReactNode; id?: string }) {
  return (
    <section className="card settings-section" id={id}>
      <div className="card-head">
        <span className="lead" style={{ width: 40, height: 40, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--md-secondary-container)', color: 'var(--md-on-secondary-container)' }}>
          <Icon name={icon} size={22} />
        </span>
        <div className="grow title-l">{title}</div>
      </div>
      <div className="stack">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 8 }}>
      <div className="grow" style={{ minWidth: 180 }}>
        <div className="body-l">{label}</div>
        {hint && <div className="body-s muted">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const settings = useStore((s) => s.settings);
  const sources = useStore((s) => s.sources);
  const set = useStore((s) => s.setSettings);
  const busy = useSyncBusy();
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [canInstall, setCanInstall] = useState(!!deferredPrompt);
  useEffect(() => {
    const h = () => setCanInstall(true);
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  return (
    <div className="page-inner" style={{ maxWidth: 880 }}>
      <header className="topbar">
        <h1 className="display-m grow" style={{ margin: 0 }}>
          Settings
        </h1>
      </header>

      <div className="stack" style={{ gap: 14 }}>
        <Section icon="calendar_month" title="Calendars" id="calendars">
          <div className="body-m muted" style={{ marginTop: -6 }}>
            School timetable, Outlook / Teams or any iCal feed. Feeds refresh automatically every 20 minutes while the app is open.
          </div>
          {sources.length > 0 && (
            <div className="list">
              {sources.map((s) => (
                <SourceRow key={s.id} src={s} />
              ))}
            </div>
          )}
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className={'btn ' + (adding ? 'text' : 'tonal')} onClick={() => setAdding(!adding)}>
              <Icon name={adding ? 'close' : 'add'} size={20} /> {adding ? 'Cancel' : 'Add calendar'}
            </button>
            {sources.some((s) => s.url) && (
              <button
                className="btn outlined"
                disabled={busy}
                onClick={async () => {
                  const r = await syncAll();
                  toast(r.failed ? `${r.failed} calendar(s) failed to sync` : `${r.ok} calendar(s) synced`);
                }}
              >
                <Icon name="sync" size={20} className={busy ? 'spinning' : ''} /> Sync all
              </button>
            )}
          </div>
          <AnimatePresence initial={false}>
            {adding && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING} style={{ overflow: 'hidden' }}>
                <div className="card flat" style={{ marginTop: 4 }}>
                  <AddSourceForm onAdded={() => setAdding(false)} defaultKind={sources.some((s) => s.kind === 'school') ? 'microsoft' : 'school'} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Section>

        <Section icon="award_star" title="Grades">
          <Row label="Import from schulNetz" hint="portal.sbl.ch → Noten. Paste or use the bookmarklet.">
            <button className="btn tonal" onClick={() => navigate('/import')}>
              <Icon name="download" size={20} /> Import
            </button>
          </Row>
          <Row label="Report-card rounding" hint="Used for “Zeugnis” grades and plus points">
            <select className="input" style={{ width: 160 }} value={settings.rounding} onChange={(e) => set({ rounding: Number(e.target.value) })}>
              <option value={0.5}>Halves (0.5)</option>
              <option value={0.25}>Quarters (0.25)</option>
              <option value={0.1}>Tenths (0.1)</option>
            </select>
          </Row>
          <Row label="Pass mark">
            <input className="input tnum" style={{ width: 90 }} inputMode="decimal" value={settings.passMark} onChange={(e) => set({ passMark: Number(e.target.value.replace(',', '.')) || 4 })} />
          </Row>
          <Row label="Show plus points" hint="Above 4 adds the difference, below 4 subtracts double">
            <Switch on={settings.showPlusPoints} onChange={(v) => set({ showPlusPoints: v })} />
          </Row>
        </Section>

        <Section icon="palette" title="Appearance">
          <Row label="Theme">
            <Segmented<ThemeMode>
              layoutId="theme-mode"
              value={settings.themeMode}
              onChange={(v) => set({ themeMode: v })}
              options={[
                { value: 'system', label: 'Auto', icon: 'contrast' },
                { value: 'light', label: 'Light', icon: 'light_mode' },
                { value: 'dark', label: 'Dark', icon: 'dark_mode' },
              ]}
            />
          </Row>
          <Field label="Accent color (Material You)">
            <div className="color-swatches">
              {SEED_PRESETS.map((p) => (
                <button key={p.hex} className={'swatch' + (settings.seed === p.hex ? ' selected' : '')} style={{ background: p.hex }} title={p.name} aria-label={p.name} onClick={() => set({ seed: p.hex })}>
                  {settings.seed === p.hex && <Icon name="check" size={18} />}
                </button>
              ))}
              <label className="swatch" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)', cursor: 'pointer' }} title="Custom">
                <input type="color" value={settings.seed} onChange={(e) => set({ seed: e.target.value })} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
              </label>
            </div>
          </Field>
          <Field label={`Liquid glass · ${Math.round(settings.glass * 100)}%`}>
            <input type="range" min={0} max={1} step={0.05} value={settings.glass} style={{ ['--p' as string]: `${settings.glass * 100}%` }} onChange={(e) => set({ glass: Number(e.target.value) })} />
          </Field>
          <Row label="Reduce motion" hint="Turns off springy animations">
            <Switch on={settings.reduceMotion} onChange={(v) => set({ reduceMotion: v })} />
          </Row>
        </Section>

        <Section icon="tune" title="General">
          <Field label="Your name">
            <input className="input" placeholder="Shown in the greeting" value={settings.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Row label="Default calendar view">
            <select className="input" style={{ width: 160 }} value={settings.defaultView} onChange={(e) => set({ defaultView: e.target.value as CalView })}>
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="agenda">Agenda</option>
            </select>
          </Row>
          <Row label="Weekends" hint="Auto shows Sat/Sun only when something is scheduled">
            <Segmented
              layoutId="weekends"
              value={settings.weekends}
              onChange={(v) => set({ weekends: v })}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'always', label: 'Show' },
                { value: 'never', label: 'Hide' },
              ]}
            />
          </Row>
        </Section>

        <Section icon="desktop_windows" title="Desk mode">
          <div className="body-m muted" style={{ marginTop: -6 }}>
            A glanceable full-screen dashboard for a small monitor next to your main screen: clock, current lesson, what’s next and upcoming tests. Keeps the screen awake.
          </div>
          <Row label="Burn-in protection" hint="Shifts the layout by a few pixels every few minutes (OLED)">
            <Switch on={settings.deskBurnInShift} onChange={(v) => set({ deskBurnInShift: v })} />
          </Row>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn filled" onClick={() => navigate('/desk')}>
              <Icon name="fullscreen" size={20} /> Open desk mode
            </button>
            <button
              className="btn outlined"
              onClick={() => {
                window.open('/desk', 'student-planner-desk', 'popup,width=1024,height=600');
              }}
            >
              <Icon name="open_in_new" size={20} /> Open in new window
            </button>
          </div>
        </Section>

        <Section icon="backup" title="Data">
          <div className="body-m muted" style={{ marginTop: -6 }}>
            All data stays on this device. Export a backup to move grades and tasks to another device.
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button
              className="btn tonal"
              onClick={() => {
                const blob = new Blob([exportBackup()], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `student-planner-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 2000);
              }}
            >
              <Icon name="download" size={20} /> Export backup
            </button>
            <button className="btn outlined" onClick={() => fileRef.current?.click()}>
              <Icon name="upload_file" size={20} /> Restore backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  useStore.getState().importBackup(JSON.parse(await f.text()));
                  toast('Backup restored');
                  syncAll().catch(() => {});
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Could not read backup');
                }
              }}
            />
            <button
              className="btn danger"
              onClick={() => {
                if (confirm('Delete all calendars, subjects, grades and tasks on this device?')) {
                  useStore.getState().resetAll();
                  toast('Everything was reset');
                  navigate('/');
                }
              }}
            >
              <Icon name="restart_alt" size={20} /> Reset
            </button>
          </div>
        </Section>

        <Section icon="info" title="About">
          {canInstall && (
            <Row label="Install app" hint="Adds Planner to your home screen / taskbar">
              <button
                className="btn filled"
                onClick={async () => {
                  await deferredPrompt?.prompt();
                  deferredPrompt = undefined;
                  setCanInstall(false);
                }}
              >
                <Icon name="download" size={20} /> Install
              </button>
            </Row>
          )}
          <div className="body-m muted">
            Student Planner 1.0 · Material 3 Expressive with liquid glass · works offline.
            <br />
            Shortcuts in the calendar: <span className="kbd">T</span> today, <span className="kbd">D</span>/<span className="kbd">W</span>/<span className="kbd">M</span>/<span className="kbd">A</span> views, <span className="kbd">←</span>/<span className="kbd">→</span> navigate, <span className="kbd">C</span> create.
          </div>
        </Section>
      </div>
    </div>
  );
}

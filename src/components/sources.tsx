import { useRef, useState, useSyncExternalStore } from 'react';
import { useStore } from '../store/store';
import { calendarName, parseIcs } from '../lib/ical';
import { syncSource, syncState } from '../lib/sync';
import { fDate, fTime } from '../lib/dates';
import type { CalendarSource, SourceKind } from '../lib/types';
import { Field, Icon, Segmented, Switch, toast } from './ui';

export function useSyncBusy() {
  return useSyncExternalStore(syncState.subscribe, () => syncState.busy, () => false);
}

const KIND_META: Record<SourceKind, { label: string; icon: string; color: string; hint: string }> = {
  school: {
    label: 'School',
    icon: 'school',
    color: '#6750a4',
    hint: 'Your iCal subscription link from portal.sbl.ch (schulNetz). Lessons are matched to subjects automatically.',
  },
  microsoft: {
    label: 'Microsoft',
    icon: 'calendar_month',
    color: '#0078d4',
    hint: 'Outlook on the web → Settings → Calendar → Shared calendars → Publish a calendar → copy the ICS link.',
  },
  other: {
    label: 'Other',
    icon: 'link',
    color: '#00897b',
    hint: 'Any iCal / webcal link (Google Calendar “secret address in iCal format”, Apple, Teams…).',
  },
};

export function AddSourceForm({ onAdded, defaultKind = 'school', compact }: { onAdded?: () => void; defaultKind?: SourceKind; compact?: boolean }) {
  const [kind, setKind] = useState<SourceKind>(defaultKind);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const { addSource, removeSource, setSourceEvents, updateSource } = useStore.getState();

  const addUrl = async () => {
    const u = url.trim();
    if (!/^(https?|webcals?):\/\//i.test(u)) {
      setError('Paste a full link starting with https:// or webcal://');
      return;
    }
    setBusy(true);
    setError(undefined);
    const id = addSource({ name: name.trim() || KIND_META[kind].label + ' calendar', kind, url: u, color: KIND_META[kind].color, enabled: true });
    try {
      await syncSource(id);
      const src = useStore.getState().sources.find((s) => s.id === id);
      toast(`Synced ${src?.eventCount ?? 0} events`);
      setUrl('');
      setName('');
      onAdded?.();
    } catch (e) {
      removeSource(id);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const addFile = async (file: File) => {
    setBusy(true);
    setError(undefined);
    try {
      const text = await file.text();
      const id = addSource({ name: name.trim() || calendarName(text) || file.name.replace(/\.ics$/i, ''), kind, fileName: file.name, color: KIND_META[kind].color, enabled: true });
      const events = parseIcs(text, { id, kind });
      setSourceEvents(id, events);
      updateSource(id, { lastSync: Date.now() });
      toast(`Imported ${events.length} events`);
      onAdded?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <Segmented
        layoutId={'src-kind' + (compact ? '-c' : '')}
        value={kind}
        onChange={setKind}
        options={(Object.keys(KIND_META) as SourceKind[]).map((k) => ({ value: k, label: KIND_META[k].label, icon: KIND_META[k].icon }))}
      />
      <div className="body-s muted" style={{ marginTop: -6, paddingLeft: 4 }}>
        {KIND_META[kind].hint}
      </div>
      <Field label="Calendar link (iCal / ICS)">
        <input
          className="input"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder={kind === 'school' ? 'https://portal.sbl.ch/gymow/cindex.php?longurl=…' : 'https://outlook.office365.com/owa/calendar/…/calendar.ics'}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addUrl()}
        />
      </Field>
      {!compact && (
        <Field label="Name (optional)">
          <input className="input" placeholder={KIND_META[kind].label + ' calendar'} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      )}
      {error && (
        <div className="row body-m" style={{ color: 'var(--md-error)', alignItems: 'flex-start' }}>
          <Icon name="error" size={20} />
          <span>{error}</span>
        </div>
      )}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn filled" disabled={busy || !url.trim()} onClick={addUrl}>
          <Icon name={busy ? 'sync' : 'cloud_download'} size={20} className={busy ? 'spinning' : ''} />
          {busy ? 'Syncing…' : 'Add & sync'}
        </button>
        <button className="btn outlined" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Icon name="upload_file" size={20} /> Import .ics file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".ics,text/calendar"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) addFile(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

export function SourceRow({ src }: { src: CalendarSource }) {
  const { updateSource, removeSource, restore } = useStore.getState();
  const [busy, setBusy] = useState(false);
  const meta = KIND_META[src.kind];
  const sync = async () => {
    setBusy(true);
    try {
      await syncSource(src.id);
      toast(`${src.name} is up to date`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="list-item" style={{ alignItems: 'center' }}>
      <span className="lead" style={{ background: 'var(--md-surface-container-highest)', color: 'var(--md-on-surface)' }}>
        <Icon name={meta.icon} size={20} />
      </span>
      <div className="grow">
        <div className="title-s ellipsis">{src.name}</div>
        <div className="body-s muted ellipsis">
          {src.lastError ? (
            <span style={{ color: 'var(--md-error)' }}>{src.lastError}</span>
          ) : (
            <>
              {src.eventCount ?? 0} events · {src.url ? 'synced' : 'imported'} {src.lastSync ? `${fDate(src.lastSync)} ${fTime(src.lastSync)}` : 'never'}
            </>
          )}
        </div>
      </div>
      {src.url && (
        <button className={'icon-btn' + (busy ? ' spin' : '')} onClick={sync} aria-label="Sync now">
          <Icon name="sync" size={20} />
        </button>
      )}
      <Switch on={src.enabled} onChange={(v) => updateSource(src.id, { enabled: v })} label="Show in calendar" />
      <button
        className="icon-btn"
        aria-label="Remove calendar"
        onClick={() => {
          const snap = { sources: useStore.getState().sources, events: useStore.getState().events };
          removeSource(src.id);
          toast(`Removed ${src.name}`, { label: 'Undo', run: () => restore(snap) });
        }}
      >
        <Icon name="delete" size={20} />
      </button>
    </div>
  );
}

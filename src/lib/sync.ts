import { useStore } from '../store/store';
import { fetchIcs, parseIcs } from './ical';

const inflight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
let syncing = 0;

export const syncState = {
  get busy() {
    return syncing > 0;
  },
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};
const emit = () => listeners.forEach((l) => l());

export function syncSource(id: string): Promise<void> {
  const existing = inflight.get(id);
  if (existing) return existing;
  const p = (async () => {
    const src = useStore.getState().sources.find((s) => s.id === id);
    if (!src?.url) return;
    syncing++;
    emit();
    try {
      const text = await fetchIcs(src.url);
      const events = parseIcs(text, src);
      useStore.getState().setSourceEvents(id, events);
    } catch (e) {
      useStore.getState().updateSource(id, { lastError: e instanceof Error ? e.message : String(e) });
      throw e;
    } finally {
      syncing--;
      inflight.delete(id);
      emit();
    }
  })();
  inflight.set(id, p);
  return p;
}

/** Syncs every enabled URL source. `maxAgeMs` skips feeds that were refreshed recently. */
export async function syncAll(maxAgeMs = 0): Promise<{ ok: number; failed: number }> {
  const now = Date.now();
  const due = useStore
    .getState()
    .sources.filter((s) => s.url && s.enabled && (!s.lastSync || now - s.lastSync >= maxAgeMs));
  const res = await Promise.allSettled(due.map((s) => syncSource(s.id)));
  return { ok: res.filter((r) => r.status === 'fulfilled').length, failed: res.filter((r) => r.status === 'rejected').length };
}

/** Background refresh: on start, every 20 minutes, and whenever the app comes back into view. */
export function startAutoSync(): () => void {
  const run = () => {
    if (navigator.onLine !== false) syncAll(15 * 60_000).catch(() => {});
  };
  run();
  const iv = setInterval(run, 20 * 60_000);
  const vis = () => document.visibilityState === 'visible' && run();
  document.addEventListener('visibilitychange', vis);
  window.addEventListener('online', run);
  return () => {
    clearInterval(iv);
    document.removeEventListener('visibilitychange', vis);
    window.removeEventListener('online', run);
  };
}

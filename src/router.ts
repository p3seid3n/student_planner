import { useSyncExternalStore } from 'react';

type Listener = () => void;
const listeners = new Set<Listener>();
let direction: 1 | -1 = 1;
let depth = (history.state as { depth?: number } | null)?.depth ?? 0;

window.addEventListener('popstate', (e) => {
  const d = (e.state as { depth?: number } | null)?.depth ?? 0;
  direction = d < depth ? -1 : 1;
  depth = d;
  listeners.forEach((l) => l());
});

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  if (path === location.pathname + location.search + location.hash) return;
  direction = 1;
  if (opts.replace) history.replaceState({ depth }, '', path);
  else history.pushState({ depth: ++depth }, '', path);
  listeners.forEach((l) => l());
}

export function back(fallback = '/') {
  if (depth > 0) history.back();
  else navigate(fallback, { replace: true });
}

const subscribe = (l: Listener) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => location.pathname, () => '/');
}
export function useSearch(): URLSearchParams {
  const s = useSyncExternalStore(subscribe, () => location.search, () => '');
  return new URLSearchParams(s);
}
export const navDirection = () => direction;

export interface Match {
  route: 'home' | 'calendar' | 'subjects' | 'subject' | 'tasks' | 'settings' | 'desk' | 'import' | 'notfound';
  params: Record<string, string>;
}

export function match(path: string): Match {
  const p = path.replace(/\/+$/, '') || '/';
  if (p === '/') return { route: 'home', params: {} };
  if (p === '/calendar') return { route: 'calendar', params: {} };
  if (p === '/subjects') return { route: 'subjects', params: {} };
  const sm = p.match(/^\/subjects\/([^/]+)$/);
  if (sm) return { route: 'subject', params: { id: decodeURIComponent(sm[1]) } };
  if (p === '/tasks') return { route: 'tasks', params: {} };
  if (p === '/settings') return { route: 'settings', params: {} };
  if (p === '/desk') return { route: 'desk', params: {} };
  if (p === '/import') return { route: 'import', params: {} };
  return { route: 'notfound', params: {} };
}

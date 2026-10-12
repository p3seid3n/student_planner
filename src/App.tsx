import { lazy, Suspense, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useStore } from './store/store';
import { useHydrated, useMediaQuery } from './store/hooks';
import { applyTheme } from './theme/theme';
import { match, navDirection, navigate, usePath } from './router';
import { startAutoSync } from './lib/sync';
import { EditorHost, useEditors } from './components/editors';
import { Icon, SPRING, SPRING_FAST, Snackbars, ThemeCtx, useSpecular } from './components/ui';
import Home from './pages/Home';
import CalendarPage from './pages/Calendar';
import Subjects from './pages/Subjects';
import SubjectDetail from './pages/SubjectDetail';
import Tasks from './pages/Tasks';

const Settings = lazy(() => import('./pages/Settings'));
const Desk = lazy(() => import('./pages/Desk'));
const ImportGrades = lazy(() => import('./pages/ImportGrades'));

const NAV = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/calendar', label: 'Calendar', icon: 'calendar_month' },
  { path: '/subjects', label: 'Subjects', icon: 'school' },
  { path: '/tasks', label: 'Tasks', icon: 'task_alt' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

function useTheme() {
  const mode = useStore((s) => s.settings.themeMode);
  const seed = useStore((s) => s.settings.seed);
  const glass = useStore((s) => s.settings.glass);
  const reduce = useStore((s) => s.settings.reduceMotion);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const dark = mode === 'dark' || (mode === 'system' && systemDark);
  const [applied, setApplied] = useState('');
  useEffect(() => {
    applyTheme(seed, dark);
    setApplied(seed + dark);
  }, [seed, dark]);
  useEffect(() => {
    document.documentElement.style.setProperty('--glass', String(glass));
    document.documentElement.dataset.reduceMotion = String(reduce);
  }, [glass, reduce]);
  return { dark, reduce, ready: applied !== '' };
}

export default function App() {
  const hydrated = useHydrated();
  const { dark, reduce } = useTheme();
  const path = usePath();
  const m = match(path);

  useEffect(() => {
    if (hydrated) return startAutoSync();
  }, [hydrated]);

  if (!hydrated) return <div className="boot" />;

  const isDesk = m.route === 'desk';
  const depth = m.route === 'subject' || m.route === 'import' ? 1 : 0;

  const page = (() => {
    switch (m.route) {
      case 'home':
        return <Home />;
      case 'calendar':
        return <CalendarPage />;
      case 'subjects':
        return <Subjects />;
      case 'subject':
        return <SubjectDetail id={m.params.id} />;
      case 'tasks':
        return <Tasks />;
      case 'settings':
        return <Settings />;
      case 'import':
        return <ImportGrades />;
      case 'desk':
        return <Desk />;
      default:
        return <Home />;
    }
  })();

  return (
    <ThemeCtx.Provider value={{ dark }}>
      <MotionConfig reducedMotion={reduce ? 'always' : 'user'} transition={SPRING}>
        <div className="ambient" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        {isDesk ? (
          <Suspense fallback={null}>{page}</Suspense>
        ) : (
          <div className="app">
            <Rail path={path} />
            <main className="app-main">
              <AnimatePresence mode="popLayout" initial={false} custom={navDirection()}>
                <motion.div
                  key={m.route === 'subject' ? path : m.route}
                  className={'page' + (m.route === 'calendar' ? ' page-cal' : '')}
                  custom={navDirection()}
                  variants={{
                    initial: (d: number) => (depth ? { opacity: 0, x: d * 60 } : { opacity: 0, y: 14, scale: 0.99 }),
                    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
                    exit: (d: number) => (depth ? { opacity: 0, x: d * -40 } : { opacity: 0, scale: 0.995, transition: { duration: 0.12 } }),
                  }}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ ...SPRING, opacity: { duration: 0.22 } }}
                >
                  <Suspense fallback={<div className="skeleton" style={{ height: 240, margin: 20 }} />}>{page}</Suspense>
                </motion.div>
              </AnimatePresence>
            </main>
            <Dock path={path} />
          </div>
        )}
        <EditorHost />
        <Snackbars />
      </MotionConfig>
    </ThemeCtx.Provider>
  );
}

function isActive(navPath: string, path: string) {
  return navPath === '/' ? path === '/' : path.startsWith(navPath);
}

function Rail({ path }: { path: string }) {
  const ref = useSpecular<HTMLElement>();
  return (
    <nav className="rail glass specular" ref={ref} aria-label="Main">
      <div className="rail-fab">
        <FabMenu placement="right" />
      </div>
      {NAV.map((n) => {
        const active = isActive(n.path, path);
        return (
          <a
            key={n.path}
            href={n.path}
            className={'rail-item' + (active ? ' active' : '')}
            onClick={(e) => {
              e.preventDefault();
              navigate(n.path);
            }}
            aria-current={active ? 'page' : undefined}
          >
            <span className="pill">
              {active && <motion.span layoutId="rail-ind" className="indicator" transition={SPRING_FAST} />}
              <Icon name={n.icon} fill={active} />
            </span>
            <span className="label-m">{n.label}</span>
          </a>
        );
      })}
      <div className="rail-spacer" />
      <a
        href="/desk"
        className="rail-item"
        onClick={(e) => {
          e.preventDefault();
          navigate('/desk');
        }}
        title="Desk mode"
      >
        <span className="pill">
          <Icon name="desktop_windows" />
        </span>
        <span className="label-m">Desk</span>
      </a>
    </nav>
  );
}

function Dock({ path }: { path: string }) {
  const ref = useSpecular<HTMLDivElement>();
  const items = NAV.filter((n) => n.path !== '/settings');
  return (
    <div className="dock">
      <div className="dock-bar glass specular" ref={ref}>
        {items.map((n) => {
          const active = isActive(n.path, path);
          return (
            <motion.button key={n.path} layout className={'dock-item' + (active ? ' active' : '')} onClick={() => navigate(n.path)} aria-label={n.label} aria-current={active ? 'page' : undefined} transition={SPRING_FAST}>
              {active && <motion.span layoutId="dock-ind" className="indicator" transition={SPRING_FAST} />}
              <Icon name={n.icon} fill={active} />
              <AnimatePresence initial={false}>
                {active && (
                  <motion.span className="label-l" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={SPRING_FAST} style={{ overflow: 'hidden' }}>
                    {n.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
        <button className={'dock-item' + (path.startsWith('/settings') ? ' active' : '')} onClick={() => navigate('/settings')} aria-label="Settings">
          {path.startsWith('/settings') && <motion.span layoutId="dock-ind" className="indicator" transition={SPRING_FAST} />}
          <Icon name="settings" fill={path.startsWith('/settings')} />
        </button>
      </div>
      <FabMenu placement="up" />
    </div>
  );
}

/** M3 Expressive FAB menu: the FAB morphs into a close button and actions spring out. */
function FabMenu({ placement }: { placement: 'up' | 'right' }) {
  const [open, setOpen] = useState(false);
  const { openTask, openGrade, openEvent } = useEditors.getState();
  const hasSubjects = useStore((s) => Object.keys(s.subjects).length > 0);
  const actions = [
    { label: 'Homework', icon: 'assignment', run: () => openTask({ type: 'homework' }) },
    { label: 'Test', icon: 'quiz', run: () => openTask({ type: 'test' }) },
    ...(hasSubjects ? [{ label: 'Grade', icon: 'award_star', run: () => openGrade({}) }] : []),
    { label: 'Event', icon: 'event', run: () => openEvent({}) },
  ];
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  return (
    <div className={'fab-menu ' + placement}>
      <AnimatePresence>
        {open && <motion.div className="fab-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.div className="fab-actions" initial="c" animate="o" exit="c" variants={{ o: { transition: { staggerChildren: 0.04 } }, c: { transition: { staggerChildren: 0.03, staggerDirection: -1 } } }}>
            {actions.map((a) => (
              <motion.button
                key={a.label}
                className="fab-action"
                variants={{ c: { opacity: 0, scale: 0.6, y: placement === 'up' ? 16 : 0, x: placement === 'right' ? -16 : 0 }, o: { opacity: 1, scale: 1, y: 0, x: 0 } }}
                transition={SPRING_FAST}
                onClick={() => {
                  setOpen(false);
                  a.run();
                }}
              >
                <Icon name={a.icon} size={22} />
                {a.label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button className={'fab' + (open ? ' open' : '')} aria-label={open ? 'Close' : 'Create'} aria-expanded={open} onClick={() => setOpen(!open)} animate={{ borderRadius: open ? 28 : 16 }} transition={SPRING_FAST}>
        <motion.span animate={{ rotate: open ? 135 : 0 }} transition={SPRING} style={{ display: 'grid' }}>
          <Icon name="add" size={28} />
        </motion.span>
      </motion.button>
    </div>
  );
}

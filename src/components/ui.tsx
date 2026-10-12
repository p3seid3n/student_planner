import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, type PanInfo, type Transition } from 'motion/react';
import { create } from 'zustand';
import { ICONS } from './icons.gen';
import { gradeTones, tonesFor } from '../theme/theme';
import { formatGrade } from '../lib/grades';

/* ---------- motion tokens (M3 Expressive springs) ---------- */
export const SPRING: Transition = { type: 'spring', stiffness: 380, damping: 31, mass: 1 };
export const SPRING_FAST: Transition = { type: 'spring', stiffness: 800, damping: 51, mass: 1 };
export const SPRING_BOUNCY: Transition = { type: 'spring', stiffness: 520, damping: 24, mass: 1 };
export const FADE: Transition = { duration: 0.2, ease: [0.2, 0, 0, 1] };

/* ---------- theme context ---------- */
export const ThemeCtx = createContext({ dark: false });
export const useDark = () => useContext(ThemeCtx).dark;
export function useTones(hex: string) {
  const dark = useDark();
  return useMemo(() => tonesFor(hex, dark), [hex, dark]);
}

/* ---------- Icon ---------- */
export function Icon({ name, size = 24, fill, className, style }: { name: string; size?: number; fill?: boolean; className?: string; style?: CSSProperties }) {
  const d = (fill && ICONS[name + '_fill']) || ICONS[name] || ICONS['school'];
  return (
    <svg className={'icon ' + (className ?? '')} width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" aria-hidden style={{ flex: 'none', ...style }}>
      <path d={d} />
    </svg>
  );
}

/* ---------- Expressive shapes (cookie, clover, sunny…) ---------- */
export function shapePath(lobes: number, amp: number, size = 100, points = 240): string {
  const c = size / 2;
  const R = c / (1 + amp);
  let d = '';
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * Math.PI * 2;
    const r = R * (1 + amp * Math.cos(lobes * t));
    const x = c + r * Math.cos(t - Math.PI / 2);
    const y = c + r * Math.sin(t - Math.PI / 2);
    d += (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return d + 'Z';
}
const SHAPES = {
  cookie9: [9, 0.07],
  cookie12: [12, 0.05],
  clover: [4, 0.16],
  sunny: [8, 0.035],
  flower: [6, 0.12],
  pill: [2, 0.05],
} as const;
export type ShapeName = keyof typeof SHAPES;

export function Shape({ shape = 'cookie9', size = 64, color, spin, children, className, style }: { shape?: ShapeName; size?: number; color: string; spin?: number; children?: ReactNode; className?: string; style?: CSSProperties }) {
  const d = useMemo(() => shapePath(SHAPES[shape][0], SHAPES[shape][1]), [shape]);
  return (
    <div className={className} style={{ position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center', flex: 'none', ...style }}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ position: 'absolute', inset: 0, animation: spin ? `spin ${spin}s linear infinite` : undefined }}>
        <path d={d} fill={color} />
      </svg>
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
}

/* ---------- Wavy progress (M3 Expressive) ---------- */
export function WavyLinear({ value, color = 'var(--md-primary)', track = 'var(--md-secondary-container)', height = 12, animate = true }: { value: number; color?: string; track?: string; height?: number; animate?: boolean }) {
  const p = Math.max(0, Math.min(1, value));
  const amp = height / 2 - 2.5;
  const wave = useMemo(() => {
    let d = `M0 ${height / 2}`;
    for (let x = 0; x <= 1600; x += 2) d += ` L${x} ${(height / 2 + amp * Math.sin((x / 24) * Math.PI * 2)).toFixed(2)}`;
    return d;
  }, [height, amp]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, height, width: '100%' }} role="progressbar" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ position: 'relative', width: `${p * 100}%`, height, overflow: 'hidden', transition: 'width .6s cubic-bezier(.2,0,0,1)' }}>
        <svg width={1600} height={height} style={{ position: 'absolute', left: 0, top: 0, animation: animate ? 'wave-move 1.2s linear infinite' : undefined }}>
          <path d={wave} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" />
        </svg>
      </div>
      {p < 0.995 && <div style={{ flex: 1, height: 4, borderRadius: 2, background: track }} />}
      {p < 0.995 && <div style={{ width: 4, height: 4, borderRadius: 2, background: color, flex: 'none' }} />}
    </div>
  );
}

export function WavyRing({ value, size = 120, stroke = 10, color = 'var(--md-primary)', track = 'var(--md-secondary-container)', waves = 10, children, className }: { value: number; size?: number; stroke?: number; color?: string; track?: string; waves?: number; children?: ReactNode; className?: string }) {
  const p = Math.max(0.001, Math.min(1, value));
  const c = size / 2;
  const R = c - stroke - 2;
  const amp = stroke * 0.22;
  const d = useMemo(() => {
    const steps = 360;
    const end = p * Math.PI * 2;
    let s = '';
    for (let i = 0; i <= steps * p; i++) {
      const t = Math.min(end, (i / steps) * Math.PI * 2);
      const r = R + amp * Math.sin(waves * t);
      s += (i ? 'L' : 'M') + (c + r * Math.sin(t)).toFixed(2) + ' ' + (c - r * Math.cos(t)).toFixed(2);
    }
    return s;
  }, [p, R, amp, waves, c]);
  const gap = 0.06;
  const trackStart = p * Math.PI * 2 + gap * Math.PI * 2;
  const trackLen = Math.max(0, Math.PI * 2 - trackStart - gap * Math.PI * 2 + 0.0001);
  const circ = 2 * Math.PI * R;
  return (
    <div className={className} style={className ? { position: 'relative' } : { position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {trackLen > 0 && p < 0.94 && (
          <circle
            cx={c}
            cy={c}
            r={R}
            fill="none"
            stroke={track}
            strokeWidth={stroke * 0.45}
            strokeLinecap="round"
            strokeDasharray={`${(trackLen / (Math.PI * 2)) * circ} ${circ}`}
            transform={`rotate(${(trackStart * 180) / Math.PI - 90} ${c} ${c})`}
          />
        )}
        <path d={d} fill="none" stroke={color} strokeWidth={stroke * 0.55} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>
    </div>
  );
}

/* ---------- Small controls ---------- */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={'switch' + (on ? ' on' : '')} onClick={() => onChange(!on)}>
      <span className="thumb" />
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, layoutId }: { value: T; options: { value: T; label: string; icon?: string }[]; onChange: (v: T) => void; layoutId: string }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.span layoutId={layoutId} className="seg-ind" transition={SPRING_FAST} />}
          {o.icon && <Icon name={o.icon} size={18} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Check({ on, color, onToggle, label }: { on: boolean; color?: string; onToggle: () => void; label?: string }) {
  return (
    <motion.button
      type="button"
      aria-pressed={on}
      aria-label={label ?? (on ? 'Mark as not done' : 'Mark as done')}
      className={'check' + (on ? ' on' : '')}
      style={{ ['--c' as string]: color }}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      whileTap={{ scale: 0.82 }}
      transition={SPRING_BOUNCY}
    >
      <AnimatePresence>
        {on && (
          <motion.svg key="c" viewBox="0 0 24 24" width={18} height={18} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={SPRING_BOUNCY}>
            <motion.path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }} />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function GradeChip({ value, lg, digits = 2, style }: { value: number | undefined; lg?: boolean; digits?: number; style?: CSSProperties }) {
  const dark = useDark();
  const t = gradeTones(value, dark);
  return (
    <span className={'grade-chip' + (lg ? ' lg' : '')} style={{ background: t.container, color: t.onContainer, ...style }}>
      {formatGrade(value, digits)}
    </span>
  );
}

export function SubjectDot({ color, size = 10 }: { color?: string; size?: number }) {
  const t = useTones(color ?? '#888');
  return <span className="subject-dot" style={{ background: t.accent, width: size, height: size }} />;
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Shape shape="cookie9" size={92} color="var(--md-tertiary-container)" spin={40}>
        <Icon name={icon} size={36} style={{ color: 'var(--md-on-tertiary-container)' }} />
      </Shape>
      <div className="title-l" style={{ color: 'var(--md-on-surface)' }}>
        {title}
      </div>
      {text && <div className="body-m" style={{ maxWidth: 380 }}>{text}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

/* ---------- Bottom sheet / dialog ---------- */
export function Sheet({ open, onClose, children, wide, label }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean; label?: string }) {
  const controls = useDragControls();
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 720px)').matches;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="scrim" className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} onClick={onClose} />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={'sheet glass' + (wide ? ' wide' : '')}
            style={{ ['--glass' as string]: 0.35, background: 'var(--md-surface-container-low)' }}
            initial={isDesktop ? { opacity: 0, scale: 0.92, y: 16 } : { y: '100%' }}
            animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={isDesktop ? { opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.16 } } : { y: '100%', transition: { type: 'spring', stiffness: 500, damping: 50 } }}
            transition={SPRING}
            drag={isDesktop ? false : 'y'}
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.9 }}
            onDragEnd={onDragEnd}
          >
            <div className="sheet-handle" onPointerDown={(e) => controls.start(e)} />
            <div className="sheet-body">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ---------- Snackbar ---------- */
interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}
const useToasts = create<{ toast?: Toast; show: (t: Omit<Toast, 'id'>) => void; hide: () => void }>((set) => ({
  toast: undefined,
  show: (t) => set({ toast: { ...t, id: Date.now() } }),
  hide: () => set({ toast: undefined }),
}));
export const toast = (text: string, action?: Toast['action']) => useToasts.getState().show({ text, action });

export function Snackbars() {
  const { toast: t, hide } = useToasts();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!t) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(hide, t.action ? 5500 : 3200);
    return () => clearTimeout(timer.current);
  }, [t, hide]);
  return createPortal(
    <AnimatePresence>
      {t && (
        <motion.div key={t.id} className="snackbar" role="status" initial={{ opacity: 0, y: 24, x: '-50%', scale: 0.96 }} animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }} exit={{ opacity: 0, y: 12, x: '-50%' }} transition={SPRING}>
          <span className="grow body-m">{t.text}</span>
          {t.action && (
            <button
              className="btn text"
              onClick={() => {
                t.action!.run();
                hide();
              }}
            >
              {t.action.label}
            </button>
          )}
          <button className="icon-btn sm" style={{ color: 'inherit' }} onClick={hide} aria-label="Dismiss">
            <Icon name="close" size={18} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ---------- Pointer-following specular highlight for glass ---------- */
export function useSpecular<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia('(pointer: coarse)').matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
  return ref;
}

export function useDelayedFlag(flag: boolean, ms: number) {
  const [v, setV] = useState(flag);
  useEffect(() => {
    if (flag) {
      setV(true);
      return;
    }
    const t = setTimeout(() => setV(false), ms);
    return () => clearTimeout(t);
  }, [flag, ms]);
  return v;
}

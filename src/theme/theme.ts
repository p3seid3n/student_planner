import {
  argbFromHex,
  Hct,
  hexFromArgb,
  MaterialDynamicColors,
  SchemeTonalSpot,
  type DynamicColor,
} from '@material/material-color-utilities';

const ROLES: Record<string, DynamicColor> = {
  primary: MaterialDynamicColors.primary,
  'on-primary': MaterialDynamicColors.onPrimary,
  'primary-container': MaterialDynamicColors.primaryContainer,
  'on-primary-container': MaterialDynamicColors.onPrimaryContainer,
  secondary: MaterialDynamicColors.secondary,
  'on-secondary': MaterialDynamicColors.onSecondary,
  'secondary-container': MaterialDynamicColors.secondaryContainer,
  'on-secondary-container': MaterialDynamicColors.onSecondaryContainer,
  tertiary: MaterialDynamicColors.tertiary,
  'on-tertiary': MaterialDynamicColors.onTertiary,
  'tertiary-container': MaterialDynamicColors.tertiaryContainer,
  'on-tertiary-container': MaterialDynamicColors.onTertiaryContainer,
  error: MaterialDynamicColors.error,
  'on-error': MaterialDynamicColors.onError,
  'error-container': MaterialDynamicColors.errorContainer,
  'on-error-container': MaterialDynamicColors.onErrorContainer,
  background: MaterialDynamicColors.background,
  surface: MaterialDynamicColors.surface,
  'surface-dim': MaterialDynamicColors.surfaceDim,
  'surface-bright': MaterialDynamicColors.surfaceBright,
  'surface-container-lowest': MaterialDynamicColors.surfaceContainerLowest,
  'surface-container-low': MaterialDynamicColors.surfaceContainerLow,
  'surface-container': MaterialDynamicColors.surfaceContainer,
  'surface-container-high': MaterialDynamicColors.surfaceContainerHigh,
  'surface-container-highest': MaterialDynamicColors.surfaceContainerHighest,
  'on-surface': MaterialDynamicColors.onSurface,
  'on-surface-variant': MaterialDynamicColors.onSurfaceVariant,
  outline: MaterialDynamicColors.outline,
  'outline-variant': MaterialDynamicColors.outlineVariant,
  'inverse-surface': MaterialDynamicColors.inverseSurface,
  'inverse-on-surface': MaterialDynamicColors.inverseOnSurface,
  'inverse-primary': MaterialDynamicColors.inversePrimary,
  'primary-fixed': MaterialDynamicColors.primaryFixed,
  'primary-fixed-dim': MaterialDynamicColors.primaryFixedDim,
  'tertiary-fixed': MaterialDynamicColors.tertiaryFixed,
  scrim: MaterialDynamicColors.scrim,
  shadow: MaterialDynamicColors.shadow,
};

export function applyTheme(seed: string, dark: boolean) {
  let argb: number;
  try {
    argb = argbFromHex(seed);
  } catch {
    argb = argbFromHex('#6750a4');
  }
  // 2025 spec = Material 3 Expressive color system
  const scheme = new SchemeTonalSpot(Hct.fromInt(argb), dark, 0, '2025');
  const root = document.documentElement;
  const lines: string[] = [];
  for (const [name, role] of Object.entries(ROLES)) {
    lines.push(`--md-${name}:${hexFromArgb(role.getArgb(scheme))};`);
  }
  let style = document.getElementById('md-theme') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'md-theme';
    document.head.appendChild(style);
  }
  style.textContent = `:root{${lines.join('')}color-scheme:${dark ? 'dark' : 'light'};}`;
  root.dataset.theme = dark ? 'dark' : 'light';
  const bg = hexFromArgb(MaterialDynamicColors.surface.getArgb(scheme));
  root.style.background = bg;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  try {
    localStorage.setItem('sp-theme-boot', JSON.stringify({ mode: dark ? 'dark' : 'light', bg }));
  } catch {
    /* private mode */
  }
  toneCache.clear();
}

export interface Tones {
  accent: string;
  onAccent: string;
  container: string;
  onContainer: string;
  soft: string;
  border: string;
}

const toneCache = new Map<string, Tones>();

function tone(h: number, c: number, t: number) {
  return hexFromArgb(Hct.from(h, c, t).toInt());
}

/** Harmonised M3 tones for a user-chosen color, readable in both themes. */
export function tonesFor(hex: string, dark = document.documentElement.dataset.theme === 'dark'): Tones {
  const key = hex + dark;
  const hit = toneCache.get(key);
  if (hit) return hit;
  let src: Hct;
  try {
    src = Hct.fromInt(argbFromHex(hex));
  } catch {
    src = Hct.fromInt(argbFromHex('#777777'));
  }
  const h = src.hue;
  const c = src.chroma < 8 ? src.chroma : Math.max(src.chroma, 40);
  const t: Tones = dark
    ? {
        accent: tone(h, c, 78),
        onAccent: tone(h, Math.min(c, 40), 18),
        container: tone(h, Math.min(c, 48), 32),
        onContainer: tone(h, Math.min(c, 30), 92),
        soft: tone(h, Math.min(c, 24), 18),
        border: tone(h, Math.min(c, 40), 45),
      }
    : {
        accent: tone(h, c, 44),
        onAccent: tone(h, 8, 99),
        container: tone(h, Math.min(c, 44), 88),
        onContainer: tone(h, Math.min(c, 40), 16),
        soft: tone(h, Math.min(c, 20), 96),
        border: tone(h, Math.min(c, 40), 72),
      };
  toneCache.set(key, t);
  return t;
}

/** Continuous Swiss grade scale: red below 4, amber at 4, green towards 6. */
export function gradeTones(value: number | undefined, dark = document.documentElement.dataset.theme === 'dark'): Tones {
  if (value === undefined) return tonesFor('#808080', dark);
  const v = Math.max(1, Math.min(6, value));
  const stops: [number, number][] = [
    [1, 20],
    [3, 28],
    [3.75, 48],
    [4, 70],
    [4.5, 95],
    [5, 125],
    [5.5, 145],
    [6, 160],
  ];
  let hue = stops[stops.length - 1][1];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [x0, h0] = stops[i - 1];
      const [x1, h1] = stops[i];
      hue = h0 + ((v - x0) / (x1 - x0)) * (h1 - h0);
      break;
    }
  }
  const key = `grade${hue.toFixed(1)}${dark}`;
  const hit = toneCache.get(key);
  if (hit) return hit;
  const c = 56;
  const t: Tones = dark
    ? {
        accent: tone(hue, c, 80),
        onAccent: tone(hue, 30, 15),
        container: tone(hue, 40, 30),
        onContainer: tone(hue, 30, 92),
        soft: tone(hue, 20, 20),
        border: tone(hue, 40, 45),
      }
    : {
        accent: tone(hue, c, 50),
        onAccent: tone(hue, 8, 99),
        container: tone(hue, 44, 88),
        onContainer: tone(hue, 40, 18),
        soft: tone(hue, 16, 96),
        border: tone(hue, 40, 70),
      };
  toneCache.set(key, t);
  return t;
}

export const SEED_PRESETS = [
  { name: 'Lilac', hex: '#6750a4' },
  { name: 'Ocean', hex: '#006a96' },
  { name: 'Forest', hex: '#2e6b30' },
  { name: 'Sunset', hex: '#b3261e' },
  { name: 'Amber', hex: '#8a5100' },
  { name: 'Rose', hex: '#984061' },
  { name: 'Teal', hex: '#006a60' },
  { name: 'Slate', hex: '#4a5c70' },
];

// Colour themes. Classic is the stylesheets' :root; the others override its
// custom properties under <html data-theme="...">.

export const THEMES = [
  { value: 'classic', label: 'Classic' },
  { value: 'latte', label: 'Catppuccin Latte' },
  { value: 'mocha', label: 'Catppuccin Mocha' },
] as const;

export type ThemeName = (typeof THEMES)[number]['value'];

export function applyTheme(name: ThemeName): void {
  document.documentElement.dataset.theme = name;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cssVar('--chrome', '#a11b2e'));
}

/** A colour custom property's current value, for canvas drawing. */
export function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

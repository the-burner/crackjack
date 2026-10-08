// Colour themes: each sets the app's colour custom properties under
// <html data-theme="...">.

export const THEMES = [
  { value: 'latte', label: 'Catppuccin Latte' },
  { value: 'mocha', label: 'Catppuccin Mocha' },
] as const;

export type ThemeName = (typeof THEMES)[number]['value'];

export function applyTheme(name: ThemeName): void {
  document.documentElement.dataset.theme = name;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cssVar('--chrome', '#11111b'));
}

/** A colour custom property's current value, for canvas drawing; `fallback` where there is no document (tests). */
export function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

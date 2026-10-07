// Colour themes. Classic is the stylesheets' :root; the others override its
// custom properties under <html data-theme="...">.

export const THEMES = [
  { value: 'classic', label: 'Classic' },
  { value: 'latte', label: 'Catppuccin Latte' },
  { value: 'mocha', label: 'Catppuccin Mocha' },
];

export function applyTheme(name) {
  document.documentElement.dataset.theme = name;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cssVar('--chrome', '#a11b2e'));
}

/** A colour custom property's current value, for canvas drawing. */
export function cssVar(name, fallback) {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

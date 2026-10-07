// Duration picker: a bottom sheet with hour / minute / second wheels, like the
// iOS Timer. Promise based, like the dialogs.

import { h } from './dom';
import { registerOverlay } from './overlays';

/** Row height; matches .wheel__item in app.css. */
const ITEM_HEIGHT = 36;

/** One wheel: `size` is its unit in the smallest column's units; `count` its rows. */
export type DurationColumn = { unit: string; label: string; size: number; count: number };

/** A wheel's column, which scrolls to its starting value (`place`) and reads the band (`read`). */
type WheelColumn = HTMLDivElement & { place: () => void; read: () => number };

const ARROW_STEPS: Readonly<Record<string, number | undefined>> = { ArrowUp: -1, ArrowDown: 1 };

/**
 * The wheels needed for durations up to `max` seconds, largest first: hours only
 * when `max` reaches two hours, minutes only when it reaches two minutes. The
 * largest wheel runs to the most `max` allows; the others wrap at 59.
 */
export function durationColumns(max: number): DurationColumn[] {
  const columns: Omit<DurationColumn, 'count'>[] = [];
  // A wheel earns its place only once two of its units fit: with one, the wheels
  // below it would run past `max` (a 60 s limit offering 1:59).
  if (max >= 7200) columns.push({ unit: 'h', label: 'Hours', size: 3600 });
  if (max >= 120) columns.push({ unit: 'min', label: 'Minutes', size: 60 });
  columns.push({ unit: 's', label: 'Seconds', size: 1 });
  return columns.map((c, i) => ({ ...c, count: i === 0 ? Math.floor(max / c.size) + 1 : 60 }));
}

/** Wheels for a value in tenths of a second, up to `max` tenths: seconds and tenths. */
export function tenthsColumns(max: number): DurationColumn[] {
  return [
    { unit: '.', label: 'Seconds', size: 10, count: Math.floor(max / 10) + 1 },
    { unit: 's', label: 'Tenths', size: 1, count: 10 },
  ];
}

/** A value (in the smallest column's units) as one number per column. */
export function splitDuration(seconds: number, columns: readonly DurationColumn[]): number[] {
  let rest = Math.max(0, Math.round(seconds));
  return columns.map((c, i) => {
    const n = i === 0 ? Math.floor(rest / c.size) : Math.floor(rest / c.size) % c.count;
    rest -= n * c.size;
    return Math.min(n, c.count - 1);
  });
}

/** Column values back to seconds, kept within [min, max]. */
export function joinDuration(
  values: readonly number[],
  columns: readonly DurationColumn[],
  { min = 0, max = Infinity }: { min?: number; max?: number } = {},
): number {
  const total = values.reduce((sum, n, i) => sum + n * columns[i].size, 0);
  return Math.min(max, Math.max(min, total));
}

/** One scrolling wheel. `el.value` is the number in the band. */
function wheel({ label, unit, count }: DurationColumn, value: number): WheelColumn {
  const items = Array.from({ length: count }, (_, n) => h('div', { class: 'wheel__item' }, String(n)));
  const list = h('div', { class: 'wheel__list' }, items);
  const el = h(
    'div',
    {
      class: 'wheel',
      tabindex: '0',
      role: 'spinbutton',
      'aria-label': label,
      'aria-valuemin': '0',
      'aria-valuemax': String(count - 1),
    },
    list,
  );
  const column = h('div', { class: 'wheel__column' }, el, h('span', { class: 'wheel__unit' }, unit));

  const index = () => Math.min(count - 1, Math.max(0, Math.round(el.scrollTop / ITEM_HEIGHT)));
  /** Tilts rows away from the band, like a drum. */
  const curve = () => {
    const centre = el.scrollTop / ITEM_HEIGHT;
    items.forEach((item, n) => {
      const offset = Math.max(-3, Math.min(3, n - centre));
      item.style.transform = `rotateX(${offset * -20}deg)`;
      item.style.opacity = String(1 - Math.min(1, Math.abs(offset) * 0.28));
    });
    el.setAttribute('aria-valuenow', String(index()));
  };
  let frame = 0;
  el.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(curve);
  });
  // With reduced motion the wheel jumps rather than glides.
  const glide = (): ScrollBehavior =>
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  const scrollToIndex = (n: number, behavior: ScrollBehavior = glide()) =>
    el.scrollTo({ top: n * ITEM_HEIGHT, behavior });
  el.addEventListener('keydown', event => {
    const step = ARROW_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const n = Math.min(count - 1, Math.max(0, index() + step));
    scrollToIndex(n, 'instant');
    curve();
  });
  // Tapping a row picks it.
  list.addEventListener('click', event => {
    const item = event.target instanceof Element ? event.target.closest<HTMLDivElement>('.wheel__item') : null;
    const n = item ? items.indexOf(item) : -1;
    if (n >= 0) scrollToIndex(n);
  });

  return Object.assign(column, {
    place: () => {
      scrollToIndex(value, 'instant');
      curve();
    },
    read: index,
  });
}

/**
 * Asks for a duration; resolves to a value within [min, max] (whole seconds, or
 * the smallest unit of `columns`), or null when cancelled.
 */
export function pickDuration({
  title,
  value,
  min = 0,
  max,
  columns = durationColumns(max),
}: {
  title: string;
  value: number;
  min?: number;
  max: number;
  columns?: readonly DurationColumn[];
}): Promise<number | null> {
  return new Promise(resolve => {
    const start = splitDuration(Math.min(max, value), columns);
    const wheels = columns.map((c, i) => wheel(c, start[i]));
    let closed = false;
    const close = (result: number | null) => {
      if (closed) return;
      closed = true;
      unregister();
      overlay.classList.add('is-leaving');
      setTimeout(() => overlay.remove(), 180);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const done = () =>
      close(
        joinDuration(
          wheels.map(w => w.read()),
          columns,
          { min, max },
        ),
      );
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(null);
      if (event.key === 'Enter') done();
    };
    const overlay = h(
      'div',
      {
        class: 'sheet-overlay',
        onclick: event => {
          if (event.target === overlay) close(null);
        },
      },
      h(
        'div',
        { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h(
          'div',
          { class: 'sheet__bar' },
          h(
            'button',
            { type: 'button', class: 'sheet__action', onclick: () => close(null), 'data-action': 'cancel' },
            'Cancel',
          ),
          h('div', { class: 'sheet__title' }, title),
          h(
            'button',
            { type: 'button', class: 'sheet__action sheet__action--done', onclick: done, 'data-action': 'done' },
            'Done',
          ),
        ),
        h('div', { class: 'wheels' }, wheels),
      ),
    );
    const unregister = registerOverlay(() => close(null));
    document.body.append(overlay);
    document.addEventListener('keydown', onKey);
    wheels.forEach(w => w.place());
    wheels[0].querySelector<HTMLElement>('.wheel')?.focus({ preventScroll: true });
  });
}

// What the specs record in the page, in the `window.__cj*` logs.

import type { SoundName } from '../../../src/services/sound.ts';

export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

/** How a seat's result pill looked when it appeared. */
export interface PillLook {
  style: Record<'radius' | 'family' | 'size' | 'weight' | 'shadow' | 'background' | 'color', string>;
  pill: Rect;
  text: Rect;
  padding: number;
  chip: Rect;
  chipOverflow: string;
  felt: Rect;
  overflowsItself: boolean;
}

/** One change seen at the table: a seat label, the buttons offered, a readout or a pop-up. */
export interface TableLogEntry {
  kind: 'chip' | 'actions' | 'bankroll' | 'counts' | 'toast';
  /** performance.now() when it was seen. */
  t: number;
  /** How many frames had been drawn by then. */
  f: number;
  text: string;
  seat?: number;
  pill?: string | null;
  tone?: string | null;
  look?: PillLook | null;
  className?: string;
  leaving?: number | null;
  removed?: number | null;
}

export interface SoundPlayed {
  name: SoundName;
  t: number;
  f: number;
}

export interface AudioStarted {
  src: string;
  t: number;
}

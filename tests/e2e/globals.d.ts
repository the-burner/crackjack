// What the specs reach for on `window`. The frame log (`__cjRecordFrames`,
// `__cjFrames`) is declared by the renderer, re-exported below.

import type { App } from '@/app/app';
import type { router } from '@/app/routes';
import type { AudioStarted, SoundPlayed, TableLogEntry } from './support/types';

export type { Frame } from '@/game/table/renderer';

declare global {
  interface Window {
    app: App & { router: typeof router };
    /** Effect names (verify-rules) or file names (verify-errors). */
    __cjSounds: string[];
    __cjPlays: SoundPlayed[];
    __cjAudio: AudioStarted[];
    __cjLog: TableLogEntry[];
    __cjDeals: number[];
    __cjOverlay: { t: number; visible: boolean }[];
    __cjChip: { t: number; text: string | null; bank: string | null }[];
    __cjStack: number[];
    __cjRolls: Record<string, number>;
    __cjResults: { text: string | null; t: number }[];
    __cjRoundStart: number;
    __cjOffered: string[];
    __cjToasts: { text: string | null; type: string | undefined }[];
    canvasFonts: string[];
  }
}

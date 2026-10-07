// A single value in a Zustand store, persisted under one storage key with
// Zustand's persist middleware.

import { createStore } from 'zustand/vanilla';
import type { Mutate, StoreApi } from 'zustand/vanilla';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Storage } from './storage';

export type ValueState<T> = { value: T };
export type PersistedStore<T> = Mutate<StoreApi<ValueState<T>>, [['zustand/persist', unknown]]>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Zustand's saved shape, `{ state: { value }, version }`. */
const isPersisted = (saved: unknown): saved is { state: { value: unknown } } =>
  isRecord(saved) && 'version' in saved && isRecord(saved.state) && 'value' in saved.state;

/**
 * A persisted value. `read` turns whatever was saved (or undefined) into a
 * valid value, so damaged or older data falls back rather than breaking. A
 * value saved bare, before the store, is read the same way.
 */
export function persistedStore<T>(storage: Storage, key: string, read: (saved: unknown) => T): PersistedStore<T> {
  return createStore<ValueState<T>>()(
    persist(() => ({ value: read(undefined) }), {
      name: key,
      storage: createJSONStorage(() => ({
        getItem: () => {
          const saved = storage.get(key);
          if (saved === undefined) return null;
          return JSON.stringify({ state: { value: isPersisted(saved) ? saved.state.value : saved }, version: 0 });
        },
        setItem: (_, value) => storage.set(key, JSON.parse(value)),
        removeItem: () => storage.remove(key),
      })),
      merge: (saved, current) => ({ ...current, value: read(isRecord(saved) ? saved.value : undefined) }),
    }),
  );
}

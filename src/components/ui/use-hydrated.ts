'use client';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

// Controls with client-only handlers must not accept input before those handlers exist.
export function useHydrated() {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}

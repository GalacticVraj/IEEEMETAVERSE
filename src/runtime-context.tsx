/**
 * RuntimeContext — provides the AppRuntime to any component in the tree
 * without prop drilling. Separated from main.tsx so that test files can
 * import components that use useRuntime() without triggering the
 * top-level document.getElementById() in main.tsx.
 */
import { createContext, useContext } from 'react';
import type { AppRuntime } from '@infra';

// A null-safe default — overridden by main.tsx at the real runtime.
export const RuntimeContext = createContext<AppRuntime | null>(null);

export function useRuntime(): AppRuntime {
  const ctx = useContext(RuntimeContext);
  if (ctx === null) {
    throw new Error('useRuntime() must be used within a <RuntimeContext.Provider>');
  }
  return ctx;
}

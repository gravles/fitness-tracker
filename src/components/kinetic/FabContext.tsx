'use client';

import { createContext, useContext, useMemo, useState, ReactNode } from 'react';

export interface FabAction {
  /** Accessible label for the FAB while this action is active, e.g. "Log set" */
  label: string;
  onPress: () => void;
}

interface FabContextValue {
  action: FabAction | null;
  /** Register a screen-specific FAB action (pass null to restore the default capture sheet). */
  setFabAction: (action: FabAction | null) => void;
}

const FabContext = createContext<FabContextValue>({
  action: null,
  setFabAction: () => {},
});

/**
 * Context-aware gold FAB. The default press opens the capture sheet; a screen
 * (e.g. the active workout session) can register its own action on mount and
 * must clear it on unmount.
 */
export function KineticFabProvider({ children }: { children: ReactNode }) {
  const [action, setFabAction] = useState<FabAction | null>(null);
  const value = useMemo(() => ({ action, setFabAction }), [action]);
  return <FabContext.Provider value={value}>{children}</FabContext.Provider>;
}

export function useFabAction() {
  return useContext(FabContext);
}

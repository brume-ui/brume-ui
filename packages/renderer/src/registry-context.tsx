import { createContext, type ReactNode, useContext } from 'react';
import { type ComponentRegistry, createRegistry } from './registry';

const EMPTY = createRegistry({ mode: 'precompiled' });
const RegistryContext = createContext<ComponentRegistry>(EMPTY);

export function RegistryProvider(props: { registry: ComponentRegistry; children: ReactNode }) {
  return (
    <RegistryContext.Provider value={props.registry}>{props.children}</RegistryContext.Provider>
  );
}

export function useRegistry(): ComponentRegistry {
  return useContext(RegistryContext);
}

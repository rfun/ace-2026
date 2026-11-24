import { createContext, useContext } from 'react';
import type { DataStore } from './store';

const StoreContext = createContext<DataStore | null>(null);

export function StoreProvider(props: { store: DataStore; children: React.ReactNode }): JSX.Element {
  return <StoreContext.Provider value={props.store}>{props.children}</StoreContext.Provider>;
}

export function useStore(): DataStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside a StoreProvider');
  return store;
}

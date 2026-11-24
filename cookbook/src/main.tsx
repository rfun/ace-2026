import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { StoreProvider } from './data/StoreProvider';
import { createMockStore } from './data/mock/mockStore';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={createMockStore({ persist: true })}>
      <App />
    </StoreProvider>
  </StrictMode>,
);

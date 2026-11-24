import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { StoreProvider } from './data/StoreProvider';
import { chooseStore, OFFLINE_NOTICE } from './data/artifact/chooseStore';

const root = createRoot(document.getElementById('root')!);

// A blank tin shell (the body background) shows while the store is chosen: no spinner.
chooseStore().then(({ store, status }) => {
  root.render(
    <StrictMode>
      <StoreProvider store={store}>
        <App notice={status === 'offline' ? OFFLINE_NOTICE : undefined} />
      </StoreProvider>
    </StrictMode>,
  );
});

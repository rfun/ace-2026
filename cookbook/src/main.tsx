import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { StoreProvider } from './data/StoreProvider';
import { chooseStore } from './data/artifact/chooseStore';

const root = createRoot(document.getElementById('root')!);

// A blank enamel shell (the body background) shows while the store is chosen: no spinner.
chooseStore().then((store) => {
  root.render(
    <StrictMode>
      <StoreProvider store={store}>
        <App />
      </StoreProvider>
    </StrictMode>,
  );
});

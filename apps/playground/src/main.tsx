import '@brume-ui/brume-tokens/tokens.css';
import '@brume-ui/brume-react/styles.css';
import '@brume-ui/brume-renderer/styles.css';
import '@fontsource/noto-sans-tc/400.css';
import '@fontsource/noto-sans-tc/600.css';
import './playground.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element.');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

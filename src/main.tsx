import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

const shouldRegisterServiceWorker =
  "serviceWorker" in navigator &&
  !["localhost", "127.0.0.1"].includes(window.location.hostname);

if (shouldRegisterServiceWorker) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.update().catch(() => undefined))
      .catch((error) => console.warn("[PWA] Service worker registration failed", error));
  });
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const shouldRegisterServiceWorker =
  "serviceWorker" in navigator &&
  !isLocalPreview;

if (isLocalPreview) {
  window.addEventListener("load", () => {
    void Promise.all([
      "serviceWorker" in navigator
        ? navigator.serviceWorker.getRegistrations().then((registrations) =>
            Promise.all(registrations.map((registration) => registration.unregister())),
          )
        : Promise.resolve([]),
      "caches" in window
        ? caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key.startsWith("eduplan-ai-")).map((key) => caches.delete(key))),
          )
        : Promise.resolve([]),
    ]).catch((error) => console.warn("[Local preview] Không thể xóa bộ nhớ đệm cũ.", error));
  });
} else if (shouldRegisterServiceWorker) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.update().catch(() => undefined))
      .catch((error) => console.warn("[PWA] Service worker registration failed", error));
  });
}

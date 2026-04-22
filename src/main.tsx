import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { ClerkProvider } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  createRoot(document.getElementById('root')!).render(
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#ff4444' }}>
      <h2>Missing Publishable Key</h2>
      <p>Vui lòng tạo 1 file <b>.env</b> ở thư mục gốc của dự án và thêm dòng sau:</p>
      <code>VITE_CLERK_PUBLISHABLE_KEY=pk_test_...</code>
      <p>Lấy key này từ trang Dashboard của <a href="https://clerk.com" style={{ color: "blue" }} target="_blank">Clerk.com</a></p>
    </div>
  );
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <App />
      </ClerkProvider>
    </StrictMode>,
  );
}

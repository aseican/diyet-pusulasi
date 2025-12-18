import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/App';
import './index.css';
import { AuthProvider } from './contexts/SupabaseAuthContext';
import { Toaster } from './components/ui/toaster';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

// iOS klavye aç/kapa sonrası "vh takılı kalma" fix
const setAppVh = () => {
  const vv = window.visualViewport;
  const h = (vv?.height ?? window.innerHeight) * 0.01;
  document.documentElement.style.setProperty('--app-vh', `${h}px`);
};

if (Capacitor.getPlatform() === 'ios') {
  Keyboard.addListener('keyboardDidHide', () => {
    requestAnimationFrame(() => {
      setAppVh();
      window.dispatchEvent(new Event('resize'));
    });
  });
}

setAppVh();
window.visualViewport?.addEventListener('resize', setAppVh);
window.addEventListener('orientationchange', setAppVh);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
      <Toaster />
    </AuthProvider>
  </React.StrictMode>
);

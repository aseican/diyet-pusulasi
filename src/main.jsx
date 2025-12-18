import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/App';
import './index.css';
import { AuthProvider } from './contexts/SupabaseAuthContext';
import { Toaster } from './components/ui/toaster';
import { Capacitor } from '@capacitor/core';

// vh hesaplayıcı (web + native ortak)
const setAppVh = () => {
  const vv = window.visualViewport;
  const h = (vv?.height ?? window.innerHeight) * 0.01;
  document.documentElement.style.setProperty('--app-vh', `${h}px`);
};

// sadece iOS native ortamda Keyboard plugin yükle
if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
  import('@capacitor/keyboard').then(({ Keyboard }) => {
    Keyboard.addListener('keyboardDidHide', () => {
      requestAnimationFrame(() => {
        setAppVh();
        window.dispatchEvent(new Event('resize'));
      });
    });
  });
}

// web + native ortak
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

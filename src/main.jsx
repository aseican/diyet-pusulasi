import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/App'; // <-- SON VE KESİN DÜZELTME: { App } eklendi
import './index.css';
import { AuthProvider } from './contexts/SupabaseAuthContext';
import { Toaster } from './components/ui/toaster'; // Toast bildirimleri için gerekli

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
      <Toaster /> {/* Bildirimleri göstermek için ekledik */}
    </AuthProvider>
  </React.StrictMode>
);
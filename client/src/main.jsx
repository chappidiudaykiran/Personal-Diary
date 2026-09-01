import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx';
import './index.css';

function ThemedToaster() {
  const { isDark } = useTheme();
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: isDark
          ? {
              background: '#181828',
              color: '#ede8d8',
              border: '1px solid rgba(196,145,58,0.3)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }
          : {
              background: '#ffffff',
              color: '#1f1b18',
              border: '1px solid rgba(179,125,40,0.3)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            },
      }}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
          <ThemedToaster />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

import React, { Suspense, lazy, useEffect, Component } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import LockScreen from './components/LockScreen.jsx';
import SetPinModal from './components/SetPinModal.jsx';
import AppSplash from './components/AppSplash.jsx';
import ClickFeedback from './components/ClickFeedback.jsx';
import apiClient from './api/apiClient.js';
import { useReminder } from './hooks/useReminder.js';

// If a route chunk fails to download (flaky/slow network), React would
// otherwise unmount to a dead black screen. Catch it: retry once
// automatically, then show a reload screen instead of black.
class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error('Route failed to load:', error);
    try {
      const msg = String(error?.message || '');
      const isChunk = /chunk|dynamically imported|importing a module/i.test(msg);
      if (isChunk && !sessionStorage.getItem('route_retry')) {
        sessionStorage.setItem('route_retry', '1');
        window.location.reload();
      }
    } catch (_) {}
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: '#000' }}>
          <p className="font-display text-xl" style={{ color: '#e9c46a' }}>Couldn't open that screen</p>
          <p className="text-sm" style={{ color: 'rgba(237,232,216,0.65)' }}>
            Your connection dropped while loading. Your entries are safe.
          </p>
          <button
            type="button"
            onClick={() => {
              try { sessionStorage.removeItem('route_retry'); } catch (_) {}
              window.location.reload();
            }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)', color: '#0c0c17' }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Code-split routes so first load is small and repeat loads come from SW cache
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const NewEntry = lazy(() => import('./pages/NewEntry.jsx'));
const ViewEntry = lazy(() => import('./pages/ViewEntry.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-app)' }}>
      <div className="text-sm font-display animate-pulse" style={{ color: 'var(--gold)' }}>
        Opening your diary…
      </div>
    </div>
  );
}

// Guard: redirect to login if not authenticated or show lock screen
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, isLocked, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-app)' }}>
        <div className="text-lg font-display animate-pulse" style={{ color: 'var(--gold)' }}>
          Opening your diary…
        </div>
      </div>
    );
  }

  if (isLocked) {
    return <LockScreen />;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Guard: redirect to dashboard if already authenticated
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLocked, loading } = useAuth();
  if (loading) return null;
  if (isLocked) return <LockScreen />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
};

export default function App() {
  const { showPinSetup, setShowPinSetup } = useAuth();

  // Warm up the Render backend on app load so the first save doesn't
  // hit a cold-start. Fire-and-forget — failures are handled per-request.
  useEffect(() => {
    apiClient.get('/health').catch(() => {});
  }, []);

  // Daily diary reminder while the app is open/installed
  useReminder();

  return (
    <>
      <AppSplash />
      <ClickFeedback />
      <RouteErrorBoundary>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/entry/new" element={<PrivateRoute><NewEntry /></PrivateRoute>} />
          <Route path="/entry/:id" element={<PrivateRoute><ViewEntry /></PrivateRoute>} />
          <Route path="/account" element={<PrivateRoute><Account /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
      </RouteErrorBoundary>

      <SetPinModal
        isOpen={showPinSetup}
        onClose={() => setShowPinSetup(false)}
      />
    </>
  );
}

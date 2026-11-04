import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import LockScreen from './components/LockScreen.jsx';
import SetPinModal from './components/SetPinModal.jsx';

// Code-split routes so first load is small and repeat loads come from SW cache
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const NewEntry = lazy(() => import('./pages/NewEntry.jsx'));
const ViewEntry = lazy(() => import('./pages/ViewEntry.jsx'));

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-app)' }}>
      <div className="text-sm font-display animate-pulse" style={{ color: 'var(--gold)' }}>
        Loading…
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
          Loading diary…
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

  return (
    <>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/entry/new" element={<PrivateRoute><NewEntry /></PrivateRoute>} />
          <Route path="/entry/:id" element={<PrivateRoute><ViewEntry /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>

      <SetPinModal
        isOpen={showPinSetup}
        onClose={() => setShowPinSetup(false)}
      />
    </>
  );
}

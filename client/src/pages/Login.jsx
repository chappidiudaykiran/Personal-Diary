import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, BookOpen, Sun, Moon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login({ email: email.trim(), password });
      toast.success('Welcome back! 📖');
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      let msg = 'Invalid credentials. Please try again.';
      if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (err.response?.data?.errors?.[0]?.msg) {
        msg = err.response.data.errors[0].msg;
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative transition-colors duration-200" style={{ background: 'var(--bg-app)' }}>
      {/* Top right theme toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-5 right-5 z-30 p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm hover:scale-105"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-muted)',
        }}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-amber-700" />}
      </button>

      {/* Left panel — literary quote */}
      <div
        className="hidden lg:flex flex-col justify-between w-[42%] flex-shrink-0 p-10 relative overflow-hidden"
        style={{
          background: 'var(--sidebar-gradient)',
          borderRight: '1px solid var(--border-color)',
        }}
      >
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 30% 50%, var(--gold-glow) 0%, transparent 70%)',
          }}
        />

        {/* Brand mark */}
        <div className="relative flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)' }}
          >
            <BookOpen className="w-4 h-4 text-[#0c0c17]" />
          </div>
          <span className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>My Diary</span>
        </div>

        {/* Central quote */}
        <div className="relative">
          <div
            className="text-5xl font-display italic leading-none mb-8"
            style={{ color: 'var(--gold)', opacity: 0.35 }}
          >
            “
          </div>
          <blockquote
            className="font-display text-2xl leading-relaxed"
            style={{ color: 'var(--text-primary)', fontWeight: 300, fontStyle: 'italic' }}
          >
            A journal is a mirror in which you see yourself clearly for the first time.
          </blockquote>
          <p className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            A private space for your everyday moments.
          </p>
        </div>

        {/* Bottom note */}
        <div className="relative text-xs" style={{ color: 'var(--text-ghost)' }}>
          Your stories. Your thoughts. Your diary.
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)' }}
            >
              <BookOpen className="w-4 h-4 text-[#0c0c17]" />
            </div>
            <span className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>My Diary</span>
          </div>

          <div className="fade-up">
            <h1
              className="font-display text-3xl mb-1"
              style={{ color: 'var(--text-primary)', fontWeight: 400 }}
            >
              Welcome back
            </h1>
            <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
              Sign in to continue your journal
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Email or Username
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com or username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-150"
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-bright)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px var(--gold-glow)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all duration-150"
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-bright)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px var(--gold-glow)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 transition-colors cursor-pointer"
                    style={{ color: 'var(--text-ghost)' }}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs py-2 px-3 rounded-lg" style={{ color: '#e05555', background: 'rgba(224,85,85,0.08)', border: '1px solid rgba(224,85,85,0.2)' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-150 mt-2 disabled:opacity-60 cursor-pointer shadow-sm"
                style={{
                  background: 'linear-gradient(135deg, #c4913a, #dba84a)',
                  color: '#0c0c17',
                }}
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
              New here?{' '}
              <Link
                to="/register"
                className="font-medium transition-colors"
                style={{ color: 'var(--gold)' }}
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

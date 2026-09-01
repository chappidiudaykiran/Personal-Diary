import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Check, BookOpen, Sun, Moon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const pwStrength = (() => {
    const p = form.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][pwStrength];
  const strengthColor = ['', '#e05555', '#d4a24a', '#7fa35b', '#4a9a6a'][pwStrength];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.email.trim() || !form.password) {
      setError('Please fill in all fields.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      toast.success('Diary created! Welcome 🎉');
      navigate('/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      let msg = 'Registration failed. Please try again.';
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

  const inputStyle = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
  };
  const focusIn = (e) => {
    e.currentTarget.style.borderColor = 'var(--border-bright)';
    e.currentTarget.style.boxShadow = '0 0 0 3px var(--gold-glow)';
  };
  const focusOut = (e) => {
    e.currentTarget.style.borderColor = 'var(--border-color)';
    e.currentTarget.style.boxShadow = 'none';
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

      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[42%] flex-shrink-0 p-10 relative overflow-hidden"
        style={{
          background: 'var(--sidebar-gradient)',
          borderRight: '1px solid var(--border-color)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 70% 40%, var(--gold-glow) 0%, transparent 70%)',
          }}
        />

        <div className="relative flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)' }}
          >
            <BookOpen className="w-4 h-4 text-[#0c0c17]" />
          </div>
          <span className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>My Diary</span>
        </div>

        <div className="relative space-y-6">
          <h2
            className="font-display text-2xl leading-relaxed"
            style={{ color: 'var(--text-primary)', fontWeight: 300, fontStyle: 'italic' }}
          >
            Begin the habit of writing to yourself.
          </h2>
          <div className="space-y-3">
            {[
              'Capture your thoughts and memories every day',
              'Organize and filter by your mood',
              'Access your private personal journal anytime',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'var(--gold-glow)', border: '1px solid var(--border-bright)' }}
                >
                  <Check className="w-2.5 h-2.5" style={{ color: 'var(--gold)' }} />
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs" style={{ color: 'var(--text-ghost)' }}>
          Your thoughts. Your stories. Your journey.
        </p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="fade-up">
            <h1 className="font-display text-3xl mb-1" style={{ color: 'var(--text-primary)', fontWeight: 400 }}>
              Create your diary
            </h1>
            <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
              A quiet space for your thoughts.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { field: 'username', label: 'Username', type: 'text', placeholder: 'yourname', autocomplete: 'username' },
                { field: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com', autocomplete: 'email' },
              ].map(({ field, label, type, placeholder, autocomplete }) => (
                <div key={field}>
                  <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {label}
                  </label>
                  <input
                    type={type}
                    value={form[field]}
                    onChange={(e) => update(field, e.target.value)}
                    placeholder={placeholder}
                    autoComplete={autocomplete}
                    autoCapitalize="none"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-150"
                    style={inputStyle}
                    onFocus={focusIn}
                    onBlur={focusOut}
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all duration-150"
                    style={inputStyle}
                    onFocus={focusIn}
                    onBlur={focusOut}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                    style={{ color: 'var(--text-ghost)' }}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.password && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="h-0.5 flex-1 rounded-full transition-all duration-300"
                          style={{ background: i <= pwStrength ? strengthColor : 'var(--border-color)' }}
                        />
                      ))}
                    </div>
                    <span className="text-xs" style={{ color: strengthColor }}>{strengthLabel}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={form.confirm}
                  onChange={(e) => update('confirm', e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-150"
                  style={{
                    ...inputStyle,
                    borderColor:
                      form.confirm && form.password !== form.confirm
                        ? 'rgba(224,85,85,0.4)'
                        : form.confirm && form.password === form.confirm
                        ? 'rgba(74,154,106,0.4)'
                        : 'var(--border-color)',
                  }}
                  onFocus={focusIn}
                  onBlur={focusOut}
                />
              </div>

              {error && (
                <p
                  className="text-xs py-2 px-3 rounded-lg"
                  style={{ color: '#e05555', background: 'rgba(224,85,85,0.08)', border: '1px solid rgba(224,85,85,0.2)' }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-150 mt-2 disabled:opacity-60 cursor-pointer shadow-sm"
                style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)', color: '#0c0c17' }}
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
              Already have an account?{' '}
              <Link to="/login" className="font-medium" style={{ color: 'var(--gold)' }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

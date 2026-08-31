import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const identifier = form.email.trim();
    const password = form.password;

    if (!identifier || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await login({ email: identifier, password });
      toast.success('Welcome back! 📖');
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error details:', err);
      let msg = 'Login failed. Check your credentials.';
      if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (err.response?.data?.errors?.[0]?.msg) {
        msg = err.response.data.errors[0].msg;
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        msg = 'Server took too long to respond (cold start). Please try again in a few seconds.';
      } else if (err.message && !err.response) {
        msg = err.message;
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-2xl shadow-lg mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-stone-800">My Private Diary</h1>
          <p className="text-stone-500 mt-1 text-sm flex items-center justify-center gap-1">
            <Lock className="w-3.5 h-3.5" /> End-to-end encrypted — only you can read it
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 fade-in">
          <h2 className="text-xl font-semibold text-stone-700 mb-6">Sign in to your diary</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email or Username */}
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1.5">Email or Username</label>
              <input
                type="text"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com or username"
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition bg-stone-50"
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Your password"
                  className="w-full px-4 py-2.5 pr-11 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition bg-stone-50"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-md"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Encryption notice */}
          <div className="mt-5 p-3 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-xs text-amber-700 text-center">
              🔐 Your password derives the encryption key locally. The key never leaves your device.
            </p>
          </div>

          <p className="text-center text-sm text-stone-500 mt-5">
            New here?{' '}
            <Link to="/register" className="text-amber-600 hover:text-amber-700 font-medium">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

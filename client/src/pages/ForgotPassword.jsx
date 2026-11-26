import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../api/apiClient.js';
import { useWallpaper } from '../context/WallpaperContext.jsx';

export default function ForgotPassword() {
  const { topInk, topMuted } = useWallpaper();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendCode = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your account email.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/forgot-password', { email: email.trim() });
      if (data.previewCode) {
        // Dev mode with no mail provider — show the code so testing works
        // without SMTP. Never happens in production.
        setCode(data.previewCode);
        toast.success(`Dev mode: your verification number is ${data.previewCode}`, { duration: 8000 });
      } else if (data.delivered === false) {
        toast.error('Sorry, the email could not be sent. Please try again later.');
        setError('Sorry, the email could not be sent right now. Please try again in a little while.');
        return;
      } else {
        toast.success('Email sent! Please check your inbox.');
      }
      setStep(2);
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not send reset code. Try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setError('Please enter the number we emailed you.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Please choose a password with at least 8 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/reset-password', {
        email: email.trim(),
        code: code.trim(),
        newPassword,
      });
      try {
        // Old PIN vault holds the OLD password — must go or next unlock derives a wrong key.
        localStorage.removeItem('diary_pin_vault');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      } catch (_) {}
      toast.success('Your password has been changed! Please sign in with your new password.');
      navigate('/login', { state: { resetMessage: 'Your password has been changed. Please sign in with your new password.' } });
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong. Please check the number and try again.';
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

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-app)' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)' }}>
            <BookOpen className="w-4 h-4 text-[#0c0c17]" />
          </div>
          <span className="font-display text-base font-semibold" style={{ color: topInk }}>My Diary</span>
        </div>

        <h1 className="font-display text-3xl mb-1" style={{ color: topInk, fontWeight: 400 }}>
          {step === 1 ? 'Forgot password' : 'Check your email'}
        </h1>
        <p className="text-sm mb-6" style={{ color: topMuted }}>
          {step === 1
            ? 'Enter your account email and we will send you a short verification number.'
            : `We have sent a verification number to ${email.trim()}. Please enter it below within 10 minutes.`}
        </p>

        {step === 1 ? (
          <form onSubmit={sendCode} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={inputStyle}
            />
            {error && <p className="text-xs py-2 px-3 rounded-lg" style={{ color: '#e05555', background: 'rgba(224,85,85,0.08)', border: '1px solid rgba(224,85,85,0.2)' }}>{error}</p>}
            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)', color: '#0c0c17' }}>
              {loading ? 'Sending email…' : (<>Send email <ArrowRight className="w-4 h-4" /></>)}
            </button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="space-y-4">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter the 6-digit code sent to your email"
              inputMode="numeric"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none tracking-widest text-center"
              style={inputStyle}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Choose a new password"
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={inputStyle}
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={inputStyle}
            />
            {error && <p className="text-xs py-2 px-3 rounded-lg" style={{ color: '#e05555', background: 'rgba(224,85,85,0.08)', border: '1px solid rgba(224,85,85,0.2)' }}>{error}</p>}
            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)', color: '#0c0c17' }}>
              {loading ? 'Saving…' : (<>Save new password <ArrowRight className="w-4 h-4" /></>)}
            </button>
            <button type="button" onClick={() => setStep(1)} className="w-full text-xs py-2 cursor-pointer" style={{ color: topMuted }}>
              Didn&apos;t get the email? Check spam or try again
            </button>
          </form>
        )}

        <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm mt-6" style={{ color: 'var(--gold)' }}>
          <ArrowLeft className="w-4 h-4" /> Back to Sign in
        </Link>
      </div>
    </div>
  );
}

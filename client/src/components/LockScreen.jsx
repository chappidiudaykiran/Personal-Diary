import React, { useState, useEffect } from 'react';
import { BookOpen, Delete, Sun, Moon, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

export default function LockScreen() {
  const { user, unlockWithPin, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // Handle PIN input
  const handleDigit = (digit) => {
    if (pin.length < 4 && !unlocking) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);

      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0 && !unlocking) {
      setPin((prev) => prev.slice(0, -1));
      setError(false);
    }
  };

  const verifyPin = async (inputPin) => {
    setUnlocking(true);
    try {
      await unlockWithPin(inputPin);
    } catch {
      setError(true);
      setPin('');
      setUnlocking(false);
    }
  };

  // Keyboard support for desktop
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, unlocking]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 select-none transition-colors duration-200"
      style={{ background: 'var(--bg-app)' }}
    >
      {/* Top bar with theme toggle & switch account */}
      <div className="w-full max-w-sm flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)' }}
          >
            <BookOpen className="w-3.5 h-3.5 text-[#0c0c17]" />
          </div>
          <span className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            My Diary
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl border transition-all cursor-pointer shadow-sm"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-muted)',
            }}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-amber-700" />}
          </button>
          <button
            onClick={logout}
            className="p-2 rounded-xl border transition-all cursor-pointer hover:bg-red-500/10 hover:text-red-500"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-ghost)',
            }}
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center user greeting & PIN dots */}
      <div className="flex flex-col items-center justify-center my-auto text-center w-full max-w-xs">
        {/* User avatar / initial */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-md text-2xl font-display font-bold uppercase"
          style={{
            background: 'linear-gradient(135deg, #c4913a, #dba84a)',
            color: '#0c0c17',
          }}
        >
          {user?.username ? user.username[0] : 'D'}
        </div>

        <h2 className="font-display text-2xl mb-1" style={{ color: 'var(--text-primary)', fontWeight: 400 }}>
          {user?.username || 'Welcome Back'}
        </h2>
        <p className="text-xs mb-8" style={{ color: 'var(--text-muted)' }}>
          {error ? (
            <span className="text-red-500 font-medium">Incorrect PIN. Try again</span>
          ) : (
            'Enter 4-digit PIN to unlock'
          )}
        </p>

        {/* 4 PIN Dots */}
        <div className={`flex items-center gap-4 mb-4 ${error ? 'animate-bounce' : ''}`}>
          {[0, 1, 2, 3].map((index) => {
            const filled = pin.length > index;
            return (
              <div
                key={index}
                className="w-4 h-4 rounded-full transition-all duration-150"
                style={{
                  background: filled ? 'var(--gold)' : 'transparent',
                  border: filled ? '2px solid var(--gold)' : '2px solid var(--border-bright)',
                  transform: filled ? 'scale(1.15)' : 'scale(1)',
                  boxShadow: filled ? '0 0 10px var(--gold)' : 'none',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Numeric Keypad */}
      <div className="w-full max-w-xs mb-6">
        <div className="grid grid-cols-3 gap-4 justify-items-center">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(String(digit))}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center text-2xl font-display transition-all duration-100 cursor-pointer active:scale-90 shadow-sm"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              {digit}
            </button>
          ))}

          {/* Bottom row */}
          <div className="w-16 h-16 flex items-center justify-center" />
          
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center text-2xl font-display transition-all duration-100 cursor-pointer active:scale-90 shadow-sm"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center transition-all duration-100 cursor-pointer active:scale-90 text-sm"
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
            }}
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Alternative sign in option */}
        <div className="text-center mt-6">
          <button
            onClick={logout}
            className="text-xs font-medium transition-colors cursor-pointer hover:underline"
            style={{ color: 'var(--gold)' }}
          >
            Sign in with email & password instead
          </button>
        </div>
      </div>
    </div>
  );
}

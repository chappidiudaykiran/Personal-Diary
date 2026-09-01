import React, { useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';

export default function SetPinModal({ isOpen, onClose }) {
  const { setPin, tempPassword } = useAuth();
  const [pin, setPinState] = useState('');
  const [confirmPin, setConfirmPinState] = useState('');
  const [step, setStep] = useState(1); // 1: Enter PIN, 2: Confirm PIN
  const [passwordInput, setPasswordInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleDigit = (d) => {
    if (step === 1) {
      if (pin.length < 4) {
        const next = pin + d;
        setPinState(next);
        if (next.length === 4) {
          setTimeout(() => setStep(2), 200);
        }
      }
    } else {
      if (confirmPin.length < 4) {
        const next = confirmPin + d;
        setConfirmPinState(next);
        if (next.length === 4) {
          submitPin(pin, next);
        }
      }
    }
  };

  const handleDelete = () => {
    if (step === 1) {
      setPinState((p) => p.slice(0, -1));
    } else {
      if (confirmPin.length === 0) {
        setStep(1);
        setPinState('');
      } else {
        setConfirmPinState((p) => p.slice(0, -1));
      }
    }
  };

  const submitPin = async (p1, p2) => {
    if (p1 !== p2) {
      toast.error('PINs do not match. Try again.');
      setPinState('');
      setConfirmPinState('');
      setStep(1);
      return;
    }

    setLoading(true);
    try {
      await setPin(p1, tempPassword || passwordInput);
      toast.success('PIN Lock configured! 🔒');
      onClose();
    } catch {
      toast.error('Failed to set PIN. Please check your password.');
    } finally {
      setLoading(false);
    }
  };

  const currentDigits = step === 1 ? pin : confirmPin;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-3xl p-6 relative shadow-2xl fade-up"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-bright)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          style={{ color: 'var(--text-ghost)' }}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: 'var(--gold-glow)', border: '1px solid var(--border-bright)' }}
          >
            <KeyRound className="w-6 h-6" style={{ color: 'var(--gold)' }} />
          </div>

          <h3 className="font-display text-xl mb-1" style={{ color: 'var(--text-primary)' }}>
            {step === 1 ? 'Set a 4-Digit PIN' : 'Confirm Your PIN'}
          </h3>
          <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
            {step === 1
              ? 'Use this PIN to quickly unlock your diary'
              : 'Re-enter your 4 digits to confirm'}
          </p>

          {!tempPassword && step === 1 && (
            <div className="w-full mb-4">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Current account password"
                className="w-full px-3 py-2 text-xs rounded-xl outline-none"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          )}

          {/* 4 Dots */}
          <div className="flex items-center gap-4 mb-6">
            {[0, 1, 2, 3].map((index) => {
              const filled = currentDigits.length > index;
              return (
                <div
                  key={index}
                  className="w-3.5 h-3.5 rounded-full transition-all duration-150"
                  style={{
                    background: filled ? 'var(--gold)' : 'transparent',
                    border: filled ? '2px solid var(--gold)' : '2px solid var(--border-bright)',
                    transform: filled ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              );
            })}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(String(digit))}
                disabled={loading}
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-display transition-all cursor-pointer active:scale-95"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                {digit}
              </button>
            ))}

            <div />

            <button
              type="button"
              onClick={() => handleDigit('0')}
              disabled={loading}
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-display transition-all cursor-pointer active:scale-95"
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
              disabled={loading}
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xs font-semibold cursor-pointer active:scale-95"
              style={{
                color: 'var(--text-muted)',
              }}
            >
              DEL
            </button>
          </div>

          <button
            onClick={onClose}
            className="mt-6 text-xs text-stone-400 hover:text-stone-600 transition"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

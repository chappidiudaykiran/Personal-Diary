import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Plus, LogOut, User, Sun, Moon, Lock, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import SetPinModal from './SetPinModal.jsx';

export default function Navbar() {
  const { user, logout, lockApp, hasPin } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showPinModal, setShowPinModal] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Goodbye!');
    navigate('/login');
  };

  const handleLock = () => {
    if (hasPin) {
      lockApp();
      toast.success('Diary locked 🔒');
    } else {
      setShowPinModal(true);
    }
  };

  return (
    <>
      <nav
        className="sticky top-0 z-20 backdrop-blur-md transition-colors duration-200"
        style={{
          background: 'var(--nav-bg)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Brand */}
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 group"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)' }}
            >
              <BookOpen className="w-3.5 h-3.5 text-[#0c0c17]" />
            </div>
            <span
              className="font-display text-base font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              My Diary
            </span>
          </Link>

          {/* Right */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-all duration-150 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--text-muted)' }}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-amber-700" />}
            </button>

            {/* Lock Button */}
            <button
              onClick={handleLock}
              className="p-2 rounded-lg transition-all duration-150 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--text-muted)' }}
              title={hasPin ? 'Lock Diary' : 'Set PIN Lock'}
            >
              {hasPin ? <Lock className="w-4 h-4 text-amber-500" /> : <KeyRound className="w-4 h-4" />}
            </button>

            {/* New entry */}
            <Link
              to="/entry/new"
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-all duration-150 shadow-sm"
              style={{
                background: 'linear-gradient(135deg, #c4913a, #dba84a)',
                color: '#0c0c17',
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Entry</span>
            </Link>

            {/* User chip */}
            {user && (
              <div
                className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
                style={{ color: 'var(--text-muted)' }}
              >
                <User className="w-3 h-3" />
                <span className="max-w-[90px] truncate">{user.username}</span>
              </div>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg transition-all duration-150 hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
              style={{ color: 'var(--text-ghost)' }}
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <SetPinModal isOpen={showPinModal} onClose={() => setShowPinModal(false)} />
    </>
  );
}

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Plus, LogOut, Lock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Goodbye! Diary locked 🔒');
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-stone-100 shadow-sm sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        {/* Brand */}
        <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          <span className="font-bold text-stone-800 text-base sm:text-lg">My Diary</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Encryption badge */}
          <span className="hidden md:flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
            <Lock className="w-3 h-3" />
            End-to-end encrypted
          </span>

          {/* New Entry */}
          <Link
            to="/entry/new"
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-medium px-2.5 py-1.5 sm:px-3 rounded-lg transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">New Entry</span>
          </Link>

          {/* User + Logout */}
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-stone-500">
              <User className="w-3.5 h-3.5" />
              <span className="max-w-[100px] truncate">{user?.username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 sm:p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

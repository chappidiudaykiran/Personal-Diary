import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../api/apiClient';
import { deriveKey } from '../crypto/cryptoUtils';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [cryptoKey, setCryptoKey] = useState(null); // AES-GCM key — lives in memory only
  const [loading, setLoading] = useState(true);

  // On mount, restore user info from localStorage (but NOT the crypto key)
  // The crypto key is NOT stored anywhere — user must re-derive it on login
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('accessToken');
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // Listen for forced logout events (e.g., refresh token expired)
  useEffect(() => {
    const handleForceLogout = () => logout();
    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, []);

  /**
   * Register a new user.
   * After registration the server returns encSalt, which we use immediately
   * to derive the AES encryption key from the user's password.
   */
  const register = useCallback(async ({ username, email, password }) => {
    const { data } = await apiClient.post('/auth/register', { username, email, password });

    // Derive encryption key in the browser — never sent to server
    const key = await deriveKey(password, data.user.encSalt);

    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));

    setUser(data.user);
    setCryptoKey(key); // store in memory only

    return data;
  }, []);

  /**
   * Login an existing user.
   * Server returns encSalt, which we use to re-derive the AES key.
   */
  const login = useCallback(async ({ email, password }) => {
    const { data } = await apiClient.post('/auth/login', { email, password });

    // Re-derive encryption key using the password + encSalt from server
    const key = await deriveKey(password, data.user.encSalt);

    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));

    setUser(data.user);
    setCryptoKey(key); // store in memory only

    return data;
  }, []);

  /**
   * Logout: clear all tokens, user state, AND the crypto key from memory.
   */
  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await apiClient.post('/auth/logout', { refreshToken });
    } catch (_) {
      // Best-effort logout
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setUser(null);
      setCryptoKey(null); // wipe key from memory
    }
  }, []);

  const isAuthenticated = !!user && !!cryptoKey;

  return (
    <AuthContext.Provider value={{ user, cryptoKey, loading, isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

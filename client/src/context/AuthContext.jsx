import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../api/apiClient';
import { deriveKey, encryptWithPin, decryptWithPin } from '../crypto/cryptoUtils';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [cryptoKey, setCryptoKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [tempPassword, setTempPassword] = useState(null); // Used right after login to set a PIN seamlessly
  const [showPinSetup, setShowPinSetup] = useState(false);

  // Restore user session and check if PIN locked
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('accessToken');
    const pinVault = localStorage.getItem('diary_pin_vault');

    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      if (pinVault) {
        setIsLocked(true);
      }
    }
    setLoading(false);
  }, []);

  // Listen for forced logout events
  useEffect(() => {
    const handleForceLogout = () => logout();
    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, []);

  /**
   * Register
   */
  const register = useCallback(async ({ username, email, password }) => {
    const { data } = await apiClient.post('/auth/register', { username, email, password });

    const key = await deriveKey(password, data.user.encSalt);

    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));

    setUser(data.user);
    setCryptoKey(key);
    setIsLocked(false);
    setTempPassword(password);
    setShowPinSetup(true);

    return data;
  }, []);

  /**
   * Login
   */
  const login = useCallback(async ({ email, password }) => {
    const { data } = await apiClient.post('/auth/login', { email, password });

    const key = await deriveKey(password, data.user.encSalt);

    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));

    setUser(data.user);
    setCryptoKey(key);
    setIsLocked(false);
    setTempPassword(password);

    const hasPinSet = Boolean(localStorage.getItem('diary_pin_vault'));
    if (!hasPinSet) {
      setShowPinSetup(true);
    }

    return data;
  }, []);

  /**
   * Save / Set a 4-digit PIN
   */
  const setPin = useCallback(async (pin, rawPassword = tempPassword) => {
    if (!rawPassword) {
      throw new Error('Password required to configure PIN');
    }
    const encrypted = await encryptWithPin(pin, rawPassword);
    localStorage.setItem('diary_pin_vault', JSON.stringify(encrypted));
    setTempPassword(null);
    setShowPinSetup(false);
    return true;
  }, [tempPassword]);

  /**
   * Unlock with 4-digit PIN
   */
  const unlockWithPin = useCallback(async (pin) => {
    const vaultStr = localStorage.getItem('diary_pin_vault');
    if (!vaultStr || !user) {
      throw new Error('No PIN lock configured');
    }

    const vault = JSON.parse(vaultStr);
    const password = await decryptWithPin(pin, vault.ciphertext, vault.salt, vault.iv);
    const key = await deriveKey(password, user.encSalt);

    setCryptoKey(key);
    setIsLocked(false);
    return true;
  }, [user]);

  /**
   * Lock the app immediately
   */
  const lockApp = useCallback(() => {
    setCryptoKey(null);
    setIsLocked(true);
  }, []);

  /**
   * Complete Logout
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
      localStorage.removeItem('diary_pin_vault');
      setUser(null);
      setCryptoKey(null);
      setIsLocked(false);
      setTempPassword(null);
      setShowPinSetup(false);
    }
  }, []);

  const hasPin = Boolean(localStorage.getItem('diary_pin_vault'));
  const isAuthenticated = !!user && !!cryptoKey && !isLocked;

  return (
    <AuthContext.Provider
      value={{
        user,
        cryptoKey,
        loading,
        isAuthenticated,
        isLocked,
        hasPin,
        showPinSetup,
        setShowPinSetup,
        tempPassword,
        login,
        register,
        logout,
        setPin,
        unlockWithPin,
        lockApp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

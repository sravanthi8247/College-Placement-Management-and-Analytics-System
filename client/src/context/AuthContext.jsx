import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearAuthData,
  getCurrentUser,
  getStoredUser,
  saveAuthData,
} from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('token')));

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    let active = true;

    getCurrentUser()
      .then((response) => {
        if (!active) return;
        const nextUser = response.data?.user || null;
        setUser(nextUser);
        if (nextUser) {
          localStorage.setItem('user', JSON.stringify(nextUser));
        }
      })
      .catch(() => {
        if (!active) return;
        clearAuthData();
        setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'admin',
      isStudent: user?.role === 'student',
      login: (token, nextUser) => {
        saveAuthData(token, nextUser);
        setUser(nextUser);
      },
      logout: () => {
        clearAuthData();
        setUser(null);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

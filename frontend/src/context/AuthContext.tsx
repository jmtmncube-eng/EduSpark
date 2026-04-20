import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '../types';

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (u: Partial<User>) => void;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const u = localStorage.getItem('es_user');
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('es_token'));

  useEffect(() => {
    if (user) localStorage.setItem('es_user', JSON.stringify(user));
    else localStorage.removeItem('es_user');
  }, [user]);

  function login(u: User, t: string) {
    setUser(u);
    setToken(t);
    localStorage.setItem('es_token', t);
    localStorage.setItem('es_user', JSON.stringify(u));
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem('es_token');
    localStorage.removeItem('es_user');
  }

  function updateUser(partial: Partial<User>) {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...partial };
      localStorage.setItem('es_user', JSON.stringify(updated));
      return updated;
    });
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

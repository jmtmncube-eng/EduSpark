import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '../types';
import { showToast } from '../components/Toast';

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (u: Partial<User>) => void;
}

const AuthContext = createContext<AuthCtx>(null!);

// Auto sign-out after this much wall-clock inactivity. Keeps a shared device
// (a school lab machine) from leaving an account open.
const IDLE_LIMIT_MS = 2 * 60 * 1000; // 2 minutes

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

  // ─── Idle auto-logout ───────────────────────────────────────────
  // While someone is signed in, watch for real activity. If the page sees no
  // interaction for IDLE_LIMIT_MS, sign out and tell them why. A single
  // 15-second poll keeps this cheap (no work on every mousemove).
  useEffect(() => {
    if (!user) return;
    let lastActivity = Date.now();
    const bump = () => { lastActivity = Date.now(); };
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const poll = setInterval(() => {
      if (Date.now() - lastActivity >= IDLE_LIMIT_MS) {
        clearInterval(poll);
        events.forEach((e) => window.removeEventListener(e, bump));
        logout();
        showToast('Signed out after 2 minutes of inactivity — sign back in to continue.', 'info');
      }
    }, 15_000);

    return () => {
      clearInterval(poll);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [user]);

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

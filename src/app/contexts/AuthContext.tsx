import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

export const API_BASE = 'http://localhost:8000/api';

interface UserRole { role: string; }
export interface User {
  id: number;
  email: string;
  name: string;
  avatar_url?: string;
  roles: UserRole[];
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (idToken: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
  primaryRole: () => string;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('academia_token'));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('academia_token');
    setToken(null);
    setUser(null);
  }, []);

  const fetchMe = useCallback(async (accessToken: string) => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Token invalid');
    return res.json() as Promise<User>;
  }, []);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetchMe(token)
      .then(setUser)
      .catch(() => { logout(); })
      .finally(() => setLoading(false));
  }, [token, fetchMe, logout]);

  const login = useCallback(async (idToken: string) => {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Login failed');
    }
    const data = await res.json();
    localStorage.setItem('academia_token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
  }, []);

  const hasRole = useCallback((...roles: string[]) => {
    if (!user) return false;
    const userRoles = new Set(user.roles.map((r: UserRole) => r.role));
    return roles.some(r => userRoles.has(r));
  }, [user]);

  const primaryRole = useCallback((): string => {
    if (!user) return '';
    const priority = ['tech_admin', 'principal', 'coordinator', 'class_teacher', 'teacher', 'student'];
    const userRoles = new Set(user.roles.map((r: UserRole) => r.role));
    return priority.find(r => userRoles.has(r)) || user.roles[0]?.role || '';
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole, primaryRole, token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

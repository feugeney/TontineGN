import React, { createContext, useContext, useState, useEffect } from 'react';
import { getToken, saveToken, deleteToken } from '@/lib/auth';
import { api } from '@/utils/api';

export interface User {
  id: string;
  phone: string;
  email?: string;
  name: string;
  avatarUrl?: string;
  walletBalance: number;
  isVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  token: string | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (t) {
        setToken(t);
        try {
          const data = await api.get<{ user: User }>('/api/users/me');
          setUser(data.user);
        } catch {
          await deleteToken();
        }
      }
      setLoading(false);
    })();
  }, []);

  const signIn = async (t: string) => {
    console.log('[Auth] Signing in with token');
    await saveToken(t);
    setToken(t);
    const data = await api.get<{ user: User }>('/api/users/me');
    setUser(data.user);
  };

  const signOut = async () => {
    console.log('[Auth] Signing out');
    await deleteToken();
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const data = await api.get<{ user: User }>('/api/users/me');
    setUser(data.user);
  };

  return (
    <AuthContext.Provider value={{ user, loading, token, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

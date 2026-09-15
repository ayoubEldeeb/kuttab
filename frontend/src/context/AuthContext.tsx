import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
  recordedSessionsCount?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (username: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const cached = localStorage.getItem('kittab_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('kittab_token') || null;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Validate session on mount
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('kittab_token');
      if (savedToken) {
        try {
          const res = await api.get('/sheikhs/me');
          if (res.data) {
            setUser(res.data);
            localStorage.setItem('kittab_user', JSON.stringify(res.data));
          }
        } catch {
          // Token invalid or expired
          localStorage.removeItem('kittab_token');
          localStorage.removeItem('kittab_user');
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password?: string) => {
    try {
      const res = await api.post('/sheikhs/login', { username, password });
      if (res.data && res.data.success) {
        const { sheikh, token: newToken } = res.data;
        setUser(sheikh);
        setToken(newToken);
        localStorage.setItem('kittab_token', newToken);
        localStorage.setItem('kittab_user', JSON.stringify(sheikh));
        localStorage.setItem('kittab_active_sheikh', JSON.stringify(sheikh));
        toast.success(`مرحباً بك، ${sheikh.name}`);
        return { success: true };
      }
      return { success: false, error: 'تعذر تسجيل الدخول' };
    } catch (err: any) {
      const msg = err.response?.data?.message || 'اسم المستخدم أو كلمة المرور غير صحيحة';
      toast.error(msg);
      return { success: false, error: msg };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('kittab_token');
    localStorage.removeItem('kittab_user');
    toast.success('تم تسجيل الخروج بنجاح');
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/sheikhs/me');
      if (res.data) {
        setUser(res.data);
        localStorage.setItem('kittab_user', JSON.stringify(res.data));
      }
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoggedIn: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, ApiClientError } from '../lib/api';
import { queryClient } from '../lib/queryClient';
import type {
  User,
  StudentProfile,
  AuthSessionResponse,
  LoginCredentials,
  RegisterStudentData,
} from '../types/auth';

interface AuthContextValue {
  user: User | null;
  profile: StudentProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  register: (data: RegisterStudentData) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSession = useCallback(async () => {
    try {
      const data = await api.get<AuthSessionResponse>('/auth/me');
      if (data && data.user) {
        setUser(data.user);
        setProfile(data.profile || null);
      } else {
        setUser(null);
        setProfile(null);
      }
    } catch (err) {
      // 401 is normal when unauthenticated on initial page load
      if (err instanceof ApiClientError && err.status === 401) {
        setUser(null);
        setProfile(null);
      } else {
        setUser(null);
        setProfile(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (credentials: LoginCredentials): Promise<User> => {
    const data = await api.post<AuthSessionResponse>('/auth/login', credentials);
    if (data && data.user) {
      setUser(data.user);
      setProfile(data.profile || null);
      queryClient.clear();
      return data.user;
    }
    throw new Error('Login response did not return valid user data.');
  };

  const register = async (studentData: RegisterStudentData): Promise<void> => {
    const data = await api.post<AuthSessionResponse>('/auth/register', studentData);
    if (data && data.user) {
      setUser(data.user);
      setProfile(data.profile || null);
      queryClient.clear();
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setProfile(null);
      queryClient.clear();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

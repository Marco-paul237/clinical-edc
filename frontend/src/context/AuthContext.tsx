'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MONITOR' | 'DATA_ENTRY' | 'PATIENT';
  site_id?: number | null;
  patient_id?: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  useMockIam: boolean;
  login: (profile: UserProfile) => void;
  logout: () => void;
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const mockProfiles: Record<string, UserProfile> = {
  'mock-admin': { id: 'mock-admin', email: 'admin@trial.com', name: 'System Admin', role: 'ADMIN', site_id: null },
  'mock-crc-1': { id: 'mock-crc-1', email: 'crc1@site1.org', name: 'John CRC Site 1', role: 'DATA_ENTRY', site_id: 1 },
  'mock-crc-2': { id: 'mock-crc-2', email: 'crc2@site2.org', name: 'Jane CRC Site 2', role: 'DATA_ENTRY', site_id: 2 },
  'mock-cra': { id: 'mock-cra', email: 'cra@sponsor.com', name: 'Alice CRA Monitor', role: 'MONITOR', site_id: null },
  'mock-patient-1': { id: 'mock-patient-1', email: 'patient1@home.com', name: 'Robert Patient 1', role: 'PATIENT', site_id: 1, patient_id: '1' }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const useMockIam = process.env.NEXT_PUBLIC_USE_MOCK_IAM === 'true';
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    // Load auth info from localStorage on startup
    const storedUser = localStorage.getItem('edc_user');
    const storedToken = localStorage.getItem('edc_token');

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }
    setIsLoading(false);
  }, []);

  const login = (profile: UserProfile) => {
    let generatedToken = '';
    
    if (useMockIam) {
      // Encode user profile as base64 string to act as mock JWT token
      const jsonStr = JSON.stringify(profile);
      generatedToken = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      }));
    } else {
      // In Keycloak mode, this token would be obtained via Keycloak login callback
      generatedToken = 'real-oidc-mock-token-placeholder';
    }

    localStorage.setItem('edc_user', JSON.stringify(profile));
    localStorage.setItem('edc_token', generatedToken);
    setUser(profile);
    setToken(generatedToken);

    // Redirect to dashboard
    router.push('/');
  };

  const logout = () => {
    localStorage.removeItem('edc_user');
    localStorage.removeItem('edc_token');
    setUser(null);
    setToken(null);
    router.push('/login');
  };

  const apiFetch = async (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    
    // Auto-inject JWT token if available
    const activeToken = token || localStorage.getItem('edc_token');
    if (activeToken) {
      headers.set('Authorization', `Bearer ${activeToken}`);
    }
    
    headers.set('Content-Type', 'application/json');

    const res = await fetch(`${backendUrl}${path}`, {
      ...options,
      headers
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${res.status}`);
    }

    return res.json();
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, useMockIam, login, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

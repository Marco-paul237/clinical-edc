'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MONITOR' | 'DATA_ENTRY';
  site_id?: number | null;
  patient_id?: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  useMockIam: boolean;
  login: (profile: UserProfile, customToken?: string, rememberMe?: boolean) => void;
  logout: () => void;
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
  isOffline: boolean;
  toggleOffline: (val: boolean) => void;
  syncQueue: any[];
  syncOfflineData: () => Promise<void>;
  switchContext: (newRole: 'ADMIN' | 'MONITOR' | 'DATA_ENTRY', newSiteId: number | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const decodeJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to decode JWT:', e);
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      return !!(params.get('access_token') || params.get('error'));
    }
    return false;
  });
  const [isOffline, setIsOffline] = useState(false);
  const [syncQueue, setSyncQueue] = useState<any[]>([]);
  const router = useRouter();

  const useMockIam = process.env.NEXT_PUBLIC_USE_MOCK_IAM === 'true';
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';

  useEffect(() => {
    // Fail-safe fallback timeout: never let the screen hang on the loading spinner for more than 2.5 seconds
    const fallbackTimer = setTimeout(() => {
      console.warn('[AUTH] Session initialization took too long. Forcing loader dismissal.');
      setIsLoading(false);
    }, 2500);

    try {
      // 1. Process OIDC redirect callback hashes first
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const error = params.get('error');
        const errorDesc = params.get('error_description');

        if (error) {
          console.error('OIDC Login Error:', error, errorDesc);
          alert(`OIDC Authentication Error: ${errorDesc || error}`);
          // Clear hash from URL
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        } else if (accessToken) {
          // Clear hash from URL
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          
          const decoded = decodeJwt(accessToken);
          if (decoded) {
            const roles = decoded.realm_access?.roles || [];
            let mappedRole: 'ADMIN' | 'MONITOR' | 'DATA_ENTRY' = 'DATA_ENTRY';
            if (roles.includes('ADMIN')) mappedRole = 'ADMIN';
            else if (roles.includes('MONITOR')) mappedRole = 'MONITOR';
            else if (roles.includes('DATA_ENTRY')) mappedRole = 'DATA_ENTRY';

            const site_id = decoded.site_id ? parseInt(decoded.site_id, 10) : null;
            const patient_id = decoded.patient_id || null;

            const profile: UserProfile = {
              id: decoded.sub,
              email: decoded.email || '',
              name: decoded.name || decoded.preferred_username || 'OIDC User',
              role: mappedRole,
              site_id,
              patient_id
            };

            // Save to sessionStorage/localStorage
            sessionStorage.setItem('edc_user', JSON.stringify(profile));
            sessionStorage.setItem('edc_token', accessToken);
            setUser(profile);
            setToken(accessToken);

            // Redirect based on role
            if (profile.role === 'DATA_ENTRY') {
              router.push('/patients');
            } else if (profile.role === 'MONITOR') {
              router.push('/audit');
            } else {
              router.push('/');
            }

            clearTimeout(fallbackTimer);
            setIsLoading(false);
            return;
          }
        }
      }

      // Load auth info and offline settings from localStorage/sessionStorage on startup
      const storedUser = localStorage.getItem('edc_user') || (typeof window !== 'undefined' ? sessionStorage.getItem('edc_user') : null);
      const storedToken = localStorage.getItem('edc_token') || (typeof window !== 'undefined' ? sessionStorage.getItem('edc_token') : null);
      const offlineVal = localStorage.getItem('edc_offline') === 'true';
      let queue = [];
      try {
        queue = JSON.parse(localStorage.getItem('edc_sync_queue') || '[]');
      } catch (e) {}

      if (storedUser && storedToken) {
        try {
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
        } catch (e) {
          localStorage.removeItem('edc_user');
          localStorage.removeItem('edc_token');
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('edc_user');
            sessionStorage.removeItem('edc_token');
          }
        }
      }
      setIsOffline(offlineVal);
      setSyncQueue(queue);
    } catch (err) {
      console.error('Failed to initialize session:', err);
    } finally {
      clearTimeout(fallbackTimer);
      setIsLoading(false);
    }

    return () => clearTimeout(fallbackTimer);
  }, []);


  const login = (profile: UserProfile, customToken?: string, rememberMe?: boolean) => {
    let generatedToken = customToken || '';
    
    if (!generatedToken) {
      if (useMockIam) {
        const jsonStr = JSON.stringify(profile);
        generatedToken = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (match, p1) => {
          return String.fromCharCode(parseInt(p1, 16));
        }));
      } else {
        generatedToken = 'real-oidc-mock-token-placeholder';
      }
    }

    if (rememberMe) {
      localStorage.setItem('edc_user', JSON.stringify(profile));
      localStorage.setItem('edc_token', generatedToken);
      localStorage.setItem('edc_remember_me', 'true');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('edc_user');
        sessionStorage.removeItem('edc_token');
      }
    } else {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('edc_user', JSON.stringify(profile));
        sessionStorage.setItem('edc_token', generatedToken);
      }
      localStorage.removeItem('edc_user');
      localStorage.removeItem('edc_token');
      localStorage.removeItem('edc_remember_me');
    }

    setUser(profile);
    setToken(generatedToken);

    // Redirect directly to the tab based on the role chosen
    if (profile.role === 'DATA_ENTRY') {
      router.push('/patients');
    } else if (profile.role === 'MONITOR') {
      router.push('/audit');
    } else {
      router.push('/');
    }
  };

  const logout = () => {
    localStorage.removeItem('edc_user');
    localStorage.removeItem('edc_token');
    localStorage.removeItem('edc_remember_me');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('edc_user');
      sessionStorage.removeItem('edc_token');
    }
    setUser(null);
    setToken(null);
    router.push('/login');
  };

  const toggleOffline = (val: boolean) => {
    setIsOffline(val);
    localStorage.setItem('edc_offline', String(val));
    if (val) {
      console.log('[EDGE SYNC] Offline mode enabled. Database modifications will be queued locally.');
    } else {
      console.log('[EDGE SYNC] Online mode enabled. Connect to backend.');
    }
  };

  const syncOfflineData = async () => {
    const queue = JSON.parse(localStorage.getItem('edc_sync_queue') || '[]');
    if (queue.length === 0) {
      alert('No offline modifications in queue to synchronize.');
      return;
    }

    const offlineForms: any[] = [];
    const offlineAuditLogs: any[] = [];

    // Parse the queued modifications
    queue.forEach((item: any, index: number) => {
      if (item.path.startsWith('/api/forms/patient/') || item.path.includes('/forms')) {
        const patientId = item.body.patient_id || parseInt(item.path.split('/').pop() || '0', 10);
        offlineForms.push({
          patient_id: patientId,
          event_name: item.body.event_name || 'Screening',
          form_type: item.body.form_type || 'VITALS',
          data: item.body.data,
          created_at: item.timestamp,
          updated_at: item.timestamp
        });

        offlineAuditLogs.push({
          user_id: user?.id,
          user_email: user?.email,
          user_name: user?.name,
          action: 'DATA_ENTRY',
          entity_type: 'FORM',
          entity_id: `OFFLINE-SYNC-${index}`,
          old_value: null,
          new_value: item.body,
          timestamp: item.timestamp
        });
      }
    });

    try {
      // Direct call to edge sync endpoint (ensure online endpoint is hit)
      const activeToken = token || localStorage.getItem('edc_token');
      const headers = new Headers();
      if (activeToken) {
        headers.set('Authorization', `Bearer ${activeToken}`);
      }
      headers.set('Content-Type', 'application/json');

      const res = await fetch(`${backendUrl}/api/edge/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          forms: offlineForms,
          auditLogs: offlineAuditLogs
        })
      });

      if (!res.ok) {
        throw new Error('Sync endpoint failed');
      }

      const result = await res.json();
      
      // Clear the local queue
      setSyncQueue([]);
      localStorage.setItem('edc_sync_queue', '[]');
      alert(`Synchronization complete!\n- Synchronized Forms: ${result.results.syncedFormsCount}\n- Synced Logs: ${result.results.syncedLogsCount}`);
    } catch (err: any) {
      console.error('Offline synchronization failed:', err);
      alert('Failed to sync offline data. Verify that the server is online.');
    }
  };

  const apiFetch = async (path: string, options: RequestInit = {}) => {
    const method = options.method || 'GET';

    // INTERCEPT: If offline, handle local simulated caching
    if (isOffline) {
      if (method === 'GET') {
        const cached = localStorage.getItem(`cache_${path}`);
        if (cached) {
          return JSON.parse(cached);
        }
        // Fallbacks
        if (path.startsWith('/api/patients/') || path.startsWith('/api/fhir/')) return null;
        return [];
      }

      if (method === 'POST' || method === 'PUT') {
        const bodyObj = options.body ? JSON.parse(options.body as string) : {};
        const queueItem = {
          path,
          method,
          body: bodyObj,
          timestamp: new Date().toISOString()
        };
        const currentQueue = JSON.parse(localStorage.getItem('edc_sync_queue') || '[]');
        const updatedQueue = [...currentQueue, queueItem];
        setSyncQueue(updatedQueue);
        localStorage.setItem('edc_sync_queue', JSON.stringify(updatedQueue));

        // Return mock success responses
        if (path.includes('/forms')) {
          const patientId = bodyObj.patient_id || parseInt(path.split('/').pop() || '0', 10);
          return {
            id: -Date.now(),
            patient_id: patientId,
            event_name: bodyObj.event_name || 'Screening',
            form_type: bodyObj.form_type || 'VITALS',
            entered_by_id: user?.id || 'offline-user',
            data: bodyObj.data || {},
            is_frozen: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }
        if (path.includes('/queries')) {
          return {
            id: -Date.now(),
            form_id: bodyObj.form_id || 1,
            field_name: bodyObj.field_name || 'weight',
            status: 'OPEN',
            description: bodyObj.description || 'Offline query',
            created_at: new Date().toISOString()
          };
        }
        return { status: 'SAVED_OFFLINE', success: true };
      }
    }

    // ONLINE FETCH
    const headers = new Headers(options.headers || {});
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
      const errorMsg = errData.error || `HTTP error! status: ${res.status}`;
      if (res.status === 401 || res.status === 403 || errorMsg.toLowerCase().includes('token') || errorMsg.toLowerCase().includes('expired')) {
        console.warn('[AUTH] Session unauthorized or expired. Automatically logging out.');
        logout();
      }
      throw new Error(errorMsg);
    }

    const data = await res.json();
    
    // Cache successful GET results for offline use
    if (method === 'GET') {
      localStorage.setItem(`cache_${path}`, JSON.stringify(data));
    }

    return data;
  };

  const switchContext = (newRole: 'ADMIN' | 'MONITOR' | 'DATA_ENTRY', newSiteId: number | null) => {
    if (!user) return;
    
    const updatedProfile: UserProfile = {
      ...user,
      role: newRole,
      site_id: newSiteId
    };

    let generatedToken = '';
    if (useMockIam) {
      const jsonStr = JSON.stringify(updatedProfile);
      generatedToken = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      }));
    } else {
      generatedToken = token || 'real-oidc-mock-token-placeholder';
    }

    const isRemembered = localStorage.getItem('edc_remember_me') === 'true';
    if (isRemembered) {
      localStorage.setItem('edc_user', JSON.stringify(updatedProfile));
      localStorage.setItem('edc_token', generatedToken);
    } else {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('edc_user', JSON.stringify(updatedProfile));
        sessionStorage.setItem('edc_token', generatedToken);
      }
    }

    setUser(updatedProfile);
    setToken(generatedToken);

    // Redirect to the appropriate tab based on the new role chosen
    if (newRole === 'DATA_ENTRY') {
      router.push('/patients');
    } else if (newRole === 'MONITOR') {
      router.push('/audit');
    } else {
      router.push('/');
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      isLoading, 
      useMockIam, 
      login, 
      logout, 
      apiFetch,
      isOffline,
      toggleOffline,
      syncQueue,
      syncOfflineData,
      switchContext
    }}>
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

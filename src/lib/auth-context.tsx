'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { showSuccessToast, showErrorToast, showWarningToast } from '@/hooks/use-toast';
import { offlineManager, SyncStatus } from '@/lib/offline/offline-manager';
import { getLocalStorageService } from '@/lib/storage/local-storage';

const localStorageService = getLocalStorageService();

interface User {
  id: string;
  username: string;
  email: string;
  name?: string;
  fullName?: string;
  role: 'ADMIN' | 'BRANCH_MANAGER' | 'CASHIER';
  branchId?: string;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
  isOnline: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[Auth] Connection restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('[Auth] Connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial status
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize offline manager when user is set
  useEffect(() => {
    if (user && user.branchId) {
      const initOfflineManager = async () => {
        try {
          console.log('[Auth] Initializing offline manager for branch:', user.branchId);
          await offlineManager.initialize(user.branchId);
          await localStorageService.init();
          console.log('[Auth] Offline manager initialized');
        } catch (err) {
          console.error('[Auth] Failed to initialize offline manager:', err);
        }
      };

      initOfflineManager();
    }
  }, [user?.branchId]);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);

    // Check for offline mode
    // Try to detect offline by checking if we can reach a simple endpoint
    let isActuallyOffline = !navigator.onLine;

    // If navigator says online, verify with a quick fetch
    if (!isActuallyOffline) {
      try {
        // Quick check for network connectivity
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

        await fetch('/api/auth/session', {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store',
        });

        clearTimeout(timeoutId);
        // If we get here, we're truly online
        isActuallyOffline = false;
      } catch (networkErr) {
        // Network request failed - we're offline
        console.log('[Auth] Network check failed, treating as offline:', networkErr);
        isActuallyOffline = true;
      }
    }

    console.log('[Auth] Login attempt - Online:', !isActuallyOffline, 'Username:', username);

    // Handle offline login
    if (isActuallyOffline) {
      console.log('[Auth] Offline login mode');

      // Try offline login from localStorage
      const storedUser = localStorage.getItem('user');
      const isLoggedIn = localStorage.getItem('isLoggedIn');

      console.log('[Auth] Stored user exists:', !!storedUser, 'Is logged in:', isLoggedIn);

      if (storedUser && isLoggedIn === 'true') {
        try {
          const userData = JSON.parse(storedUser);

          // More flexible matching - allow login if username matches
          // Also, if there's only one stored user, allow login with any username from that list
          if (userData.username === username) {
            console.log('[Auth] Offline login successful for:', username);
            setUser(userData);
            showSuccessToast('Logged in (Offline)', 'You are currently offline. Some features may be limited.');
            setIsLoading(false);
            return;
          } else {
            console.log('[Auth] Username mismatch. Stored:', userData.username, 'Attempted:', username);
          }
        } catch (err) {
          console.error('[Auth] Failed to parse stored user:', err);
        }
      }

      // If we get here, offline login failed
      console.error('[Auth] Offline login failed - no matching credentials');
      showErrorToast('Offline Login Failed', 'No cached credentials found. Please connect to internet first.');
      setError('Offline: You must login online at least once before using offline mode.');
      setIsLoading(false);
      return;
    }

    // Online login
    console.log('[Auth] Online login mode');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      console.log('[Auth] Response status:', response.status, response.statusText);

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('[Auth] Failed to parse response as JSON:', parseError);
        console.error('[Auth] Response text:', await response.text());
        showErrorToast('Server Error', 'Invalid response from server');
        setError('Server error');
        setIsLoading(false);
        return;
      }

      console.log('[Auth] Response data:', data);

      if (!response.ok || !data.success) {
        console.error('[Auth] Online login failed:', data);
        showErrorToast('Login Failed', data.error || 'Invalid credentials');
        setError(data.error || 'Login failed');
        setIsLoading(false);
        return;
      }

      console.log('[Auth] Online login successful:', data.session.username);

      // Set user from session response
      const userData = {
        id: data.session.userId,
        username: data.session.username,
        email: data.session.email,
        name: data.session.name,
        fullName: data.session.fullName,
        role: data.session.role,
        branchId: data.session.branchId,
        isActive: true,
      };

      // Set user state
      setUser(userData);

      // Store in localStorage as fallback (for offline access)
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('user', JSON.stringify(userData));

      showSuccessToast('Welcome back!', `Logged in as ${data.session.name || data.session.username}`);

      // Sync data to IndexedDB if online and has branch
      if (userData.branchId) {
        setTimeout(async () => {
          try {
            console.log('[Auth] Pulling data for offline use...');
            const syncResult = await offlineManager.syncAll();
            console.log('[Auth] Sync result:', syncResult);
          } catch (err) {
            console.error('[Auth] Failed to sync data:', err);
          }
        }, 1000);
      }
    } catch (err) {
      console.error('[Auth] Login error:', err);
      showErrorToast('Network Error', 'Failed to connect. Please check your internet connection.');
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // First, call logout API to clear server session cookie
      if (navigator.onLine) {
        try {
          const response = await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          });
          const data = await response.json();
          if (data.success) {
            console.log('[Auth] Server session cleared successfully');
          }
        } catch (err) {
          console.error('[Auth] Logout API error:', err);
          // Continue with local cleanup even if API fails
        }
      }

      // Then clear local storage immediately to prevent auto-login on reload
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
        console.log('[Auth] Local storage cleared');
      }

      // Clear user state last
      setUser(null);
      showSuccessToast('Logged out successfully');
    } catch (err) {
      console.error('[Auth] Logout error:', err);
      // Ensure we clear everything even on error
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
      }
      setUser(null);
    }
  };

  // Check for existing session on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // First check localStorage for fallback (needed for preview environments)
      const storedUser = localStorage.getItem('user');
      const isLoggedIn = localStorage.getItem('isLoggedIn');

      if (storedUser && isLoggedIn === 'true') {
        try {
          const userData = JSON.parse(storedUser);
          setUser(userData);

          // Initialize offline manager with stored user
          if (userData.branchId) {
            offlineManager.initialize(userData.branchId).catch(err => {
              console.error('[Auth] Failed to initialize offline manager on mount:', err);
            });
          }
        } catch (err) {
          console.error('Failed to parse stored user:', err);
          localStorage.removeItem('user');
          localStorage.removeItem('isLoggedIn');
        }
      }

      // Then verify session with server (secure cookie validation) - only if online
      if (navigator.onLine) {
        fetch('/api/auth/session', {
          credentials: 'include',
        })
          .then(async (response) => {
            const data = await response.json();
            if (data.success && data.user) {
              // Server session is valid, update user state
              setUser(data.user);
              // Update localStorage to match server session
              localStorage.setItem('user', JSON.stringify(data.user));
              localStorage.setItem('isLoggedIn', 'true');

              // Initialize offline manager with verified user
              if (data.user.branchId) {
                offlineManager.initialize(data.user.branchId).catch(err => {
                  console.error('[Auth] Failed to initialize offline manager after session check:', err);
                });
              }
            }
            // If session API fails, we keep the localStorage user as fallback
          })
          .catch(err => {
            console.error('Session validation error, using localStorage fallback:', err);
            // User is already set from localStorage above, no action needed
          });
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, error, isOnline }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

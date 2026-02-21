'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Coffee, Lock, AlertCircle, Bean, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const { login, isLoading, error, user } = useAuth();

  // Redirect if user is logged in
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  // Check actual network connectivity
  const checkConnection = async () => {
    setIsCheckingConnection(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      await fetch('/api/auth/session', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);
      setIsOffline(false);
    } catch (err) {
      console.log('[LoginPage] Connection check failed - offline mode');
      setIsOffline(true);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  // Check connection on mount and when online/offline events fire
  useEffect(() => {
    const handleOnline = () => {
      console.log('[LoginPage] Browser says online, verifying...');
      checkConnection();
    };
    const handleOffline = () => {
      console.log('[LoginPage] Browser says offline');
      setIsOffline(true);
    };

    // Initial check
    checkConnection();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic check every 10 seconds
    const interval = setInterval(checkConnection, 10000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(username, password);
  };

  return (
    <div className="min-h-screen">
      {/* Beautiful Coffee-Themed Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F3A2E] via-[#0B2B22] to-[#C7A35A]"></div>
        <div className="absolute inset-0 opacity-20">
          {/* Coffee bean patterns */}
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="coffee-bean-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                <ellipse cx="40" cy="40" rx="20" ry="15" fill="none" stroke="#C7A35A" strokeWidth="1.5" opacity="0.08" transform="rotate(30 40 40)"/>
                <ellipse cx="40" cy="40" rx="18" ry="13" fill="none" stroke="#C7A35A" strokeWidth="1.5" opacity="0.06" transform="rotate(-20 40 40)"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#coffee-bean-pattern)"/>
          </svg>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#C7A35A] to-[#b88e3b] text-white rounded-3xl mb-6 shadow-2xl relative">
              <div className="absolute -top-2 -right-2">
                <Bean className="h-8 w-8 text-white opacity-30" />
              </div>
              <Coffee className="h-10 w-10" />
            </div>
            <h1 className="text-5xl font-extrabold bg-gradient-to-r from-[#0F3A2E] to-[#C7A35A] bg-clip-text text-transparent mb-2 drop-shadow-lg">
              Emperor Coffee
            </h1>
            <p className="text-[#0F3A2E]/80 dark:text-[#FFFDF8]/80 text-lg">
              Multi-Branch Point of Sale System
            </p>
          </div>

          <Card className="border-[#C7A35A]/30 shadow-2xl bg-[#FFFDF8]/95 dark:bg-[#0F3A2E]/95 backdrop-blur-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold text-[#0F3A2E] dark:text-[#FFFDF8]">Welcome Back</CardTitle>
                  <CardDescription className="text-[#0F3A2E]/70 dark:text-[#FFFDF8]/70 mt-1">
                    Enter your credentials to access Emperor Coffee POS
                  </CardDescription>
                </div>
                {/* Connection Status Indicator */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                  isCheckingConnection
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    : isOffline
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                }`}>
                  {isCheckingConnection ? (
                    <>
                      <div className="h-4 w-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                      Checking...
                    </>
                  ) : isOffline ? (
                    <>
                      <WifiOff className="h-4 w-4" />
                      Offline
                    </>
                  ) : (
                    <>
                      <Wifi className="h-4 w-4" />
                      Online
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Offline Info Banner */}
              {isOffline && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800 dark:text-amber-300">
                        You are currently offline
                      </p>
                      <p className="text-amber-700 dark:text-amber-400 mt-1">
                        You can login if you have previously logged in on this device. Otherwise, please connect to the internet first.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-[#0F3A2E] dark:text-[#FFFDF8] font-medium">Username</Label>
                  <div className="relative">
                    <Coffee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#C7A35A]" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="e.g., admin, manager1, cashier1"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-10 border-[#C7A35A]/30 focus:border-[#C7A35A] focus:ring-[#C7A35A]/50"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[#0F3A2E] dark:text-[#FFFDF8] font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#C7A35A]" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="•••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 border-[#C7A35A]/30 focus:border-[#C7A35A] focus:ring-[#C7A35A]/50"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <span className="text-sm text-red-600 dark:text-red-400">
                      {error}
                    </span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#C7A35A] to-[#b88e3b] hover:from-[#b88e3b] hover:to-[#C7A35A] text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white/30 border-t-transparent animate-spin rounded-full"></div>
                      Signing in...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Sign In
                      <Coffee className="h-5 w-5" />
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

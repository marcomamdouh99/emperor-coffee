/**
 * PWA Install Prompt Component
 * Shows a prompt to install the app as a PWA for offline use
 */

'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show prompt after 2 seconds
      setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    try {
      // Show the install prompt
      await deferredPrompt.prompt();

      // Wait for user response
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('[PWA] User accepted install prompt');
      } else {
        console.log('[PWA] User dismissed install prompt');
      }

      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error('[PWA] Install error:', error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for this session
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  // Don't show if already dismissed in this session
  useEffect(() => {
    if (sessionStorage.getItem('pwa-prompt-dismissed')) {
      setShowPrompt(false);
    }
  }, []);

  if (isInstalled) {
    return null;
  }

  if (isIOS) {
    return (
      <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Install Emperor Coffee POS
            </DialogTitle>
            <DialogDescription>
              Install this app on your iOS device for offline access:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Tap the <strong>Share</strong> button (box with arrow up)</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
              <li>Tap <strong>Add</strong> in the top right corner</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              After installation, you can use this app without an internet connection!
            </p>
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={handleDismiss}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-emerald-600" />
            Install Emperor Coffee POS
          </DialogTitle>
          <DialogDescription>
            Install this app for offline access to your POS system
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span>
              <span>Work offline without internet</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span>
              <span>Faster load times</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span>
              <span>Access from home screen</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span>
              <span>Automatic sync when online</span>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            After installation, the app will work even without an internet connection.
            All your data will sync automatically when you're back online.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleDismiss}>
            Not Now
          </Button>
          <Button onClick={handleInstall} className="bg-emerald-600 hover:bg-emerald-700">
            <Download className="h-4 w-4 mr-2" />
            Install App
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

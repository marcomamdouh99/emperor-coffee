/**
 * Service Worker Loader
 * This script runs before the main React app to register the service worker as early as possible
 * This enables true offline functionality
 */

(function() {
  'use strict';

  // Check if service workers are supported
  if ('serviceWorker' in navigator) {
    // Register the service worker immediately
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      }).then(function(registration) {
        console.log('[SW-Loader] Service Worker registered successfully:', registration.scope);

        // Check for updates
        registration.addEventListener('updatefound', function() {
          var newWorker = registration.installing;
          if (newWorker) {
            console.log('[SW-Loader] New service worker installing...');
            newWorker.addEventListener('statechange', function() {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW-Loader] New service worker available');
                // Notify the app about the update
                window.dispatchEvent(new CustomEvent('sw-update-available'));
              }
            });
          }
        });

        // Handle controller change (new service worker activated)
        navigator.serviceWorker.addEventListener('controllerchange', function() {
          console.log('[SW-Loader] Service worker controller changed, reloading...');
          window.location.reload();
        });

      }).catch(function(error) {
        console.error('[SW-Loader] Service Worker registration failed:', error);
      });
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'CACHE_UPDATED') {
        console.log('[SW-Loader] Cache updated:', event.data.url);
      }
    });

  } else {
    console.warn('[SW-Loader] Service Workers are not supported in this browser');
  }

  // Log online/offline status
  function updateOnlineStatus() {
    console.log('[SW-Loader] Connection status:', navigator.onLine ? 'online' : 'offline');
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

})();

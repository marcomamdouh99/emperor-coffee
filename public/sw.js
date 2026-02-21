/**
 * Service Worker for Emperor Coffee POS
 * Enables offline functionality by caching app assets
 */

const CACHE_NAME = 'emperor-pos-v2';
const CACHE_PREFIX = 'emperor-pos-';

// Routes to skip (API calls, not static files)
const SKIP_ROUTES = [
  '/api/',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');

      // Cache the root page first
      return cache.add('/').then(() => {
        console.log('[Service Worker] Root page cached');
      });
    })
  );

  // Force the waiting service worker to become active
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME;
          })
          .map((cacheName) => {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );

  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip API routes - let them fall through to network
  if (SKIP_ROUTES.some((route) => url.pathname.startsWith(route))) {
    // For API calls, try network first, fail gracefully
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({
          error: 'Offline',
          message: 'No internet connection. Request queued for sync.'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Skip Chrome extensions
  if (url.protocol === 'chrome-extension:' || url.protocol === 'chrome-search:') {
    return;
  }

  // Skip non-HTTP requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Cache hit - return cached response
      if (cachedResponse) {
        // Try to update in background (when online)
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse.clone());
            });
          }
        }).catch(() => {
          // Offline - just use cached version
          console.log('[Service Worker] Using cached version:', request.url);
        });

        return cachedResponse;
      }

      // Cache miss - fetch from network and cache it
      return fetch(request).then((networkResponse) => {
        // Check if valid response
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        // Clone response to cache
        const responseToCache = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      }).catch((error) => {
        // Network failed - try to return cached version or fallback
        console.log('[Service Worker] Network failed for:', request.url);

        // For HTML requests, return cached root
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/').then((rootResponse) => {
            if (rootResponse) {
              return rootResponse;
            }
            // Return offline HTML page
            return new Response(
              `<!DOCTYPE html>
              <html>
              <head>
                <title>Offline - Emperor Coffee POS</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #065f46 0%, #064e3b 100%);
                    color: white;
                  }
                  .container {
                    text-align: center;
                    padding: 2rem;
                    max-width: 400px;
                  }
                  .icon {
                    font-size: 64px;
                    margin-bottom: 1rem;
                  }
                  h1 {
                    margin: 0 0 1rem 0;
                    font-size: 24px;
                  }
                  p {
                    margin: 0 0 1.5rem 0;
                    opacity: 0.9;
                    line-height: 1.5;
                  }
                  button {
                    background: white;
                    color: #065f46;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.2s;
                  }
                  button:hover {
                    transform: scale(1.05);
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="icon">☕</div>
                  <h1>You're Offline</h1>
                  <p>The Emperor Coffee POS app is currently offline. Your data is saved locally and will sync automatically when you reconnect.</p>
                  <button onclick="location.reload()">Try Again</button>
                </div>
              </body>
              </html>`,
              {
                status: 200,
                headers: { 'Content-Type': 'text/html' }
              }
            );
          });
        }

        // Return error response
        return new Response('Offline - No cached data available', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain'
          })
        });
      });
    })
  );
});

// Message event - handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      cacheNames.forEach((cacheName) => {
        caches.delete(cacheName);
      });
    });
  }
});

// Sync event - handle background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-operations') {
    console.log('[Service Worker] Background sync triggered');
    // The actual sync will be handled by the offline manager when the app opens
  }
});

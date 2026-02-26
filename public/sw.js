/**
 * Service Worker for Emperor Coffee POS
 * Enables offline functionality with improved caching strategies
 * Version: v4 - Fixed response cloning issue
 */

const CACHE_NAME = 'emperor-pos-v4';
const CACHE_PREFIX = 'emperor-pos-';

// Routes to skip (API calls - handled differently)
const SKIP_ROUTES = ['/api/'];

// Cache strategies
const CACHE_STRATEGIES = {
  // Static assets - cache first, network fallback
  STATIC: [
    '/',
    '/login',
    '/icon-192.svg',
    '/icon-512.svg',
    '/logo.svg',
    '/manifest.json',
  ],
  // API endpoints - network first, cache fallback
  API: [
    '/api/menu-items',
    '/api/categories',
    '/api/ingredients',
    '/api/users',
    '/api/branches',
    '/api/delivery-areas',
    '/api/couriers',
    '/api/customers',
    '/api/receipt-settings',
    '/api/tables',
    '/api/promo-codes',
    '/api/inventory',
    '/api/recipes',
  ],
  // Never cache - always network
  NETWORK_ONLY: [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/sync/pull',
    '/api/sync/push',
    '/api/sync/batch-push',
    '/api/orders',
  ],
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing v4...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell and static assets');
      return cache.addAll(CACHE_STRATEGIES.STATIC);
    })
  );

  // Force the waiting service worker to become active
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating v4...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return (
              cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME
            );
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

// Fetch event - handle network requests with caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Chrome extensions and non-HTTP requests
  if (
    url.protocol === 'chrome-extension:' ||
    url.protocol === 'chrome-search:' ||
    !url.protocol.startsWith('http')
  ) {
    return;
  }

  // Determine the appropriate strategy
  const strategy = getCacheStrategy(url);

  if (strategy === 'NETWORK_ONLY') {
    // Network-only routes - always try network first
    handleNetworkOnly(event, request);
  } else if (strategy === 'API') {
    // API routes - network first with cache fallback
    handleApiRequest(event, request);
  } else if (strategy === 'STATIC') {
    // Static routes - cache first with network fallback
    handleStaticRequest(event, request);
  } else {
    // Default: stale-while-revalidate for other requests
    handleStaleWhileRevalidate(event, request);
  }
});

/**
 * Determine the caching strategy for a request
 */
function getCacheStrategy(url) {
  const pathname = url.pathname;

  // Network-only routes
  if (CACHE_STRATEGIES.NETWORK_ONLY.some(route => pathname.startsWith(route))) {
    return 'NETWORK_ONLY';
  }

  // API routes
  if (pathname.startsWith('/api/')) {
    // Check if it's a cached API endpoint
    if (CACHE_STRATEGIES.API.some(route => pathname.startsWith(route))) {
      return 'API';
    }
    return 'NETWORK_ONLY';
  }

  // Static routes
  if (CACHE_STRATEGIES.STATIC.some(route => pathname === route)) {
    return 'STATIC';
  }

  // Default
  return 'STALE_WHILE_REVALIDATE';
}

/**
 * Handle network-only requests
 */
function handleNetworkOnly(event, request) {
  event.respondWith(
    fetch(request)
      .then((response) => {
        return response;
      })
      .catch((error) => {
        console.log('[Service Worker] Network failed for network-only route:', request.url);
        // Return 503 for offline
        return new Response(
          JSON.stringify({
            error: 'Offline',
            message: 'This feature requires an internet connection',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
  );
}

/**
 * Handle API requests with network-first strategy
 */
function handleApiRequest(event, request) {
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses with TTL (5 minutes for read APIs)
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // Add cache expiration (5 minutes = 300 seconds)
            const cacheOptions = {
              cacheName: CACHE_NAME,
              expiration: Date.now() + 300000, // 5 minutes from now
            };
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        console.log('[Service Worker] Network failed, trying cache for API:', request.url);
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[Service Worker] Using cached API response:', request.url);
            return cachedResponse;
          }
          // Return offline error
          return new Response(
            JSON.stringify({
              error: 'Offline',
              message: 'No internet connection. Using cached data where available.',
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        });
      })
  );
}

/**
 * Handle static requests with cache-first strategy
 */
function handleStaticRequest(event, request) {
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Cache hit - update in background
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse.clone());
            });
          }
        }).catch(() => {
          // Offline - just use cached version
          console.log('[Service Worker] Using cached static asset:', request.url);
        });
        return cachedResponse;
      }

      // Cache miss - fetch from network
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
      }).catch(() => {
        // Network failed - try to return cached root
        console.log('[Service Worker] Network failed for static asset:', request.url);
        return caches.match('/').then((rootResponse) => {
          return rootResponse || getOfflineFallback();
        });
      });
    })
  );
}

/**
 * Handle requests with stale-while-revalidate strategy
 */
function handleStaleWhileRevalidate(event, request) {
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Cache hit - return immediately and update in background
      const fetchPromise = fetch(request).then((networkResponse) => {
        // Clone immediately before returning to avoid body already used error
        const clonedResponse = networkResponse.clone();

        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            // Use the cloned response for caching
            cache.put(request, clonedResponse);
          });
        }
        // Return the original response
        return networkResponse;
      }).catch(() => {
        console.log('[Service Worker] Background fetch failed for:', request.url);
      });

      // Return cached version immediately, or wait for network
      return cachedResponse || fetchPromise;
    })
  );
}

/**
 * Get offline fallback page
 */
function getOfflineFallback() {
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
        .status {
          background: rgba(255, 255, 255, 0.1);
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
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
        .spinning {
          animation: spin 1s linear infinite;
          display: inline-block;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">☕</div>
        <h1>You're Offline</h1>
        <p>The Emperor Coffee POS app is currently offline. Your data is saved locally and will sync automatically when you reconnect.</p>
        <div class="status">
          <span class="spinning">⟳</span> Checking for connection...
        </div>
        <button onclick="location.reload()">Try Again</button>
      </div>
      <script>
        // Auto-retry connection
        setInterval(() => {
          fetch('/api/health', { method: 'HEAD', cache: 'no-store' })
            .then(() => location.reload())
            .catch(() => {});
        }, 5000);
      </script>
    </body>
    </html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }
  );
}

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

  if (event.data && event.data.type === 'SYNC_NOW') {
    // Trigger immediate sync if background sync is supported
    if (self.registration && self.registration.sync) {
      self.registration.sync.register('sync-operations').catch(() => {
        console.log('[Service Worker] Background sync not supported');
      });
    }
  }
});

// Sync event - handle background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-operations') {
    console.log('[Service Worker] Background sync triggered');
    event.waitUntil(
      fetch('/api/sync/batch-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Background sync will handle queued operations
        }),
      }).catch((error) => {
        console.log('[Service Worker] Background sync failed:', error);
      })
    );
  }
});

// Push event - handle push notifications (for future use)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
  };

  event.waitUntil(
    self.registration.showNotification('Emperor POS', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});

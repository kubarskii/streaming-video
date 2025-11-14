// Service Worker for PWA offline support
const CACHE_NAME = 'videotrubka-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching essential assets');
      return cache.addAll(urlsToCache).catch(err => {
        console.error('[SW] Failed to cache some assets:', err);
      });
    })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - network-first strategy for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip unsupported request schemes (chrome-extension, etc.)
  if (url.protocol === 'chrome-extension:' || url.protocol === 'chrome:' || url.protocol === 'moz-extension:') {
    return;
  }

  // Skip cross-origin requests (except for fonts and CDN assets)
  if (url.origin !== location.origin && !url.pathname.match(/\.(woff2?|ttf|otf)$/)) {
    return;
  }

  // API requests - Network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
        // Clone the response before caching (skip unsupported schemes)
        if (request.url && !request.url.startsWith('chrome-extension:') && !request.url.startsWith('chrome:') && !request.url.startsWith('moz-extension:')) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache).catch(err => {
              // Ignore cache errors for unsupported schemes
              if (!err.message.includes('unsupported')) {
                console.error('[SW] Cache put error:', err);
              }
            });
          });
        }
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request);
        })
    );
    return;
  }

  // Video streaming - don't intercept, let requests pass through normally
  // This prevents service worker from interfering with HLS streaming and CORS
  if (url.pathname.startsWith('/video')) {
    // Don't call event.respondWith() - let the request pass through to the network
    return;
  }

  // Static assets - Cache first, network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version and update in background
        fetch(request).then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response);
            });
          }
        }).catch(() => {
          // Fetch failed, but we have cache so it's ok
        });
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(request).then((response) => {
        // Check if we received a valid response
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Clone the response before caching (skip unsupported schemes)
        if (request.url && !request.url.startsWith('chrome-extension:') && !request.url.startsWith('chrome:') && !request.url.startsWith('moz-extension:')) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache).catch(err => {
              // Ignore cache errors for unsupported schemes
              if (!err.message.includes('unsupported')) {
                console.error('[SW] Cache put error:', err);
              }
            });
          });
        }

        return response;
      });
    })
  );
});

// Handle service worker updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// iOS-specific optimizations
// Prevent iOS from closing service worker too aggressively
let keepAliveInterval;
self.addEventListener('activate', () => {
  // Ping every 20 seconds to keep service worker alive on iOS
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  keepAliveInterval = setInterval(() => {
    // Empty function to keep service worker active
  }, 20000);
});


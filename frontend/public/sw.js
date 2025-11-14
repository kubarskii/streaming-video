// Service Worker for PWA offline support
// Updated cache version to clear old 403 errors
const CACHE_NAME = 'videotrubka-v2';
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
      // Delete all old caches (including old version that might have 403 errors)
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('[SW] Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('[SW] All old caches cleared, including any cached 403 errors');
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
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

  // Static assets (/assets/) - Network first, don't cache errors
  // This prevents caching 403 errors and ensures fresh content
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses (200-299)
          // Don't cache errors (403, 404, 500, etc.)
          if (response && response.ok && response.status >= 200 && response.status < 300) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache).catch(err => {
                if (!err.message.includes('unsupported')) {
                  console.error('[SW] Cache put error:', err);
                }
              });
            });
          } else {
            // For errors, try cache as fallback, but don't cache the error itself
            return caches.match(request).then((cachedResponse) => {
              // Return cached version if available, otherwise return the error
              return cachedResponse || response;
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || new Response('Network error', { status: 503 });
          });
        })
    );
    return;
  }

  // Other static assets - Network first, cache only successful responses
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful responses (200-299)
        // Don't cache errors (403, 404, 500, etc.)
        if (response && response.ok && response.status >= 200 && response.status < 300) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache).catch(err => {
              if (!err.message.includes('unsupported')) {
                console.error('[SW] Cache put error:', err);
              }
            });
          });
        } else {
          // For errors, try cache as fallback
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || response;
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request).then((cachedResponse) => {
          return cachedResponse || new Response('Network error', { status: 503 });
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


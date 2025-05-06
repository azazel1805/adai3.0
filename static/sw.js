// sw.js

// IMPORTANT: Increment this version if you change urlsToCache or the SW logic
const CACHE_NAME = 'adai-cache-v2'; // Example: Increment from v1 to v2

// Add URLs of static assets you want to cache
// Ensure these paths are correct and the files exist.
const urlsToCache = [
  '/', // Cache the root URL (index.html)
  '/static/css/style.css',
  '/static/js/script.js',
  '/static/js/pwa.js',
  '/static/js/speech.js',
  '/static/manifest.json',
  // '/static/images/logo.png', // Uncomment and ensure this path is correct if you have a logo
  '/static/images/icons/icon-192x192.png',
  '/static/images/icons/icon-512x512.png'
  // Add other essential assets like fonts if you use local ones
  // '/offline.html' // Consider an offline fallback page
];

// Install event: Cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell assets');
        return cache.addAll(urlsToCache)
          .catch(error => {
            console.error('Service Worker: Failed to cache all initial assets during install.', error);
            // If critical assets fail to cache, you might want the install to fail.
            // throw error;
          });
      })
      .then(() => {
        console.log('Service Worker: App shell cached. Installation complete.');
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
      .catch(error => {
          console.error('Service Worker: Installation failed:', error);
      })
  );
});

// Activate event: Clean up old caches and take control
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  const cacheWhitelist = [CACHE_NAME]; // Only keep the current cache

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache -', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Old caches deleted. Claiming clients...');
      // Take control of all open clients (pages) that this SW should control.
      return self.clients.claim();
    }).catch(error => {
        console.error('Service Worker: Activation failed:', error);
    })
  );
});

// Fetch event: Serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;

  // 1. Bypass for non-GET requests
  if (request.method !== 'GET') {
       return;
   }

  // 2. CRITICAL FIX: Bypass for chrome-extension:// requests
  if (request.url.startsWith('chrome-extension://')) {
    event.respondWith(fetch(request)); // Let the browser handle its own extension resources
    return;
  }

  // 3. For API calls, always go to the network
  if (request.url.includes('/api/')) {
        event.respondWith(
            fetch(request)
                .catch(error => {
                    console.warn('SW: API fetch failed for:', request.url, error);
                    // Optionally provide a generic JSON error response or re-throw
                    // return new Response(JSON.stringify({ error: "Network error" }), { headers: { 'Content-Type': 'application/json' }});
                    throw error;
                })
        );
        return;
   }

  // 4. For other GET requests (our static assets): Cache-first, then network, then update cache
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Serve from cache
          // console.log('Service Worker: Serving from cache:', request.url);
          return cachedResponse;
        }

        // Not in cache, fetch from network
        // console.log('Service Worker: Fetching from network:', request.url);
        return fetch(request).then(
             networkResponse => {
                 // Check if we received a valid response to cache
                 if (!networkResponse || networkResponse.status !== 200 ||
                     (networkResponse.type !== 'basic' && networkResponse.type !== 'opaque')) {
                     // console.log('SW: Not caching invalid response for:', request.url, networkResponse.status, networkResponse.type);
                     return networkResponse; // Return without caching
                 }

                 // Clone the response because it can only be consumed once
                 const responseToCache = networkResponse.clone();

                 caches.open(CACHE_NAME).then(cache => {
                     // console.log('SW: Caching new network response for:', request.url);
                     cache.put(request, responseToCache)
                        .catch(err => {
                            console.error('SW: Failed to cache response for:', request.url, err);
                        });
                 });
                 return networkResponse; // Return the original response to the browser
             }
        ).catch(error => {
             console.warn('Service Worker: Network fetch failed for asset:', request.url, error);
             // Optional: Return a fallback offline page if network fails for navigation
             // if (request.mode === 'navigate') {
             //     return caches.match('/offline.html');
             // }
             // throw error; // Re-throw to let the browser handle the error display
        });
      })
  );
});

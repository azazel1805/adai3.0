const CACHE_NAME = 'adai-cache-v1';
// Add URLs of essential static assets needed for the app shell to work offline
const urlsToCache = [
  '/', // Cache the root URL (index.html)
  '/static/css/style.css',
  '/static/js/script.js',
  '/static/js/pwa.js',      // <= Check this path
  '/static/js/speech.js',   // <= Check this path
  '/static/manifest.json',  // <= Check this path
  '/static/images/logo.png', // <= Check this path (if you have it)
  '/static/images/icons/icon-192x192.png', // <= Check this path
  '/static/images/icons/icon-512x512.png'  // <= Check this path
];

// Install event: Cache essential assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        // Use addAll for atomic caching; if one fails, none are cached.
        return cache.addAll(urlsToCache).catch(error => {
          console.error('Failed to cache urls:', error);
          // Decide if installation should fail if caching fails
          // throw error; // Uncomment to make installation fail
        });
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  const cacheWhitelist = [CACHE_NAME]; // Only keep the current cache
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Claiming clients');
      // Take control of currently open pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch event: Serve cached assets or fetch from network (Cache-First for cached assets)
self.addEventListener('fetch', event => {
  // Let the browser handle requests for non-GET methods (like POST to API)
  if (event.request.method !== 'GET') {
    return;
  }

  // For API calls or other dynamic content, always go to the network
  if (event.request.url.includes('/api/')) {
     // Network first for API calls might be better, but simple network fetch is fine too
     event.respondWith(fetch(event.request));
     return;
  }

  // For assets defined in urlsToCache, try cache first
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // console.log('Service Worker: Returning cached response for:', event.request.url);
          return cachedResponse;
        }
        // console.log('Service Worker: Fetching from network:', event.request.url);
        // If not in cache, fetch from network
        // Optionally, cache the new response here for future offline use
        return fetch(event.request).then(networkResponse => {
            // Optional: Cache dynamic assets if needed (use carefully)
             /* if (networkResponse && networkResponse.status === 200) {
                 const responseToCache = networkResponse.clone();
                 caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                 });
             } */
             return networkResponse;
         }).catch(error => {
             console.error('Service Worker: Fetch failed:', error);
             // Optionally return a fallback offline page/resource here
             // return caches.match('/offline.html');
         });
      })
  );
});

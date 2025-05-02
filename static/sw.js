const CACHE_NAME = 'adai-cache-v1';
// Add URLs of static assets you want to cache
const urlsToCache = [
  '/', // Cache the root URL (index.html)
  '/static/css/style.css',
  '/static/js/script.js',
  '/static/js/pwa.js',
  '/static/js/speech.js',
  '/static/manifest.json',
  '/static/images/logo.png', // Cache your logo if you have one
  '/static/images/icons/icon-192x192.png',
  '/static/images/icons/icon-512x512.png'
  // Add other essential assets like fonts if you use local ones
];

// Install event: Cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
          console.error('Service Worker: Failed to cache app shell:', error);
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Take control of pages immediately
});

// Fetch event: Serve from cache, fallback to network (Cache First for static assets)
self.addEventListener('fetch', event => {
  // We only want to cache GET requests for our assets
  if (event.request.method !== 'GET') {
       return;
   }

   // For API calls, always go to the network
   if (event.request.url.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
   }

  // For other GET requests (our static assets)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          // Serve from cache
          // console.log('Service Worker: Serving from cache:', event.request.url);
          return response;
        }
        // Not in cache, fetch from network
        // console.log('Service Worker: Fetching from network:', event.request.url);
        return fetch(event.request).then(
             networkResponse => {
                 // Optional: Cache fetched assets dynamically if needed (be careful with this)
                 // if(networkResponse && networkResponse.status === 200 && urlsToCache.includes(event.request.url)) {
                 //     const responseToCache = networkResponse.clone();
                 //     caches.open(CACHE_NAME).then(cache => {
                 //         cache.put(event.request, responseToCache);
                 //     });
                 // }
                 return networkResponse;
             }
        ).catch(error => {
             console.error('Service Worker: Fetch failed:', error);
             // Optional: Return a fallback offline page if network fails
             // return caches.match('/offline.html');
        });
      })
  );
});
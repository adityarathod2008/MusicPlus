const CACHE_NAME = 'musicplus-cache-v1';
const urlsToCache = [
  '/music_app.html',
  '/style.css',
  '/js/audio-player.js',
  '/js/script.js',
  '/landing_page/icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // We only want to cache the shell/UI, not the actual audio streams or API calls
  if (event.request.url.includes('/stream/') || event.request.url.includes('/search') || event.request.url.includes('youtube')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

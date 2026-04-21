// Simple Service Worker for PWA compliance
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // basic pass-through
});

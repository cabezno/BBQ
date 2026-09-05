/**
 * BBQ MOBILE P2P - Service Worker (PWA Offline & Install)
 * Cache-first strategy for static assets, network-first for API/WS
 */

const CACHE_NAME = 'bbq-pwa-v25';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/manifest.json',
    '/js/db.js',
    '/js/identity.js',
    '/js/storage-engine.js',
    '/js/p2p-node.js',
    '/js/webrtc-node.js',
    '/js/contacts.js',
    '/js/logistics-engine.js',
    '/js/ai-orchestrator.js',
    '/js/escrow-engine.js',
    '/js/google-pay-engine.js',
    '/js/referral-engine.js',
    '/js/automation-engine.js',
    '/js/p2p-live-engine.js',
    '/js/call-engine.js',
    '/js/workflow-ai.js',
    '/js/tts.js',
    '/js/stt.js',
    '/js/onboarding.js',
    '/js/app.js',
    '/js/bbq-integration.js',
    '/icons/icon-192.svg',
    '/icons/icon-512.svg'
];

// External resources to cache
const EXTERNAL_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&display=swap',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'
];

// ─── Install: Pre-cache static assets ───────────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Installing BBQ Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Cache local assets (these must succeed)
            return cache.addAll(STATIC_ASSETS).then(() => {
                // Try to cache external assets but don't fail if offline
                return Promise.allSettled(
                    EXTERNAL_ASSETS.map(url => 
                        cache.add(url).catch(err => 
                            console.warn(`[SW] Could not cache external: ${url}`, err)
                        )
                    )
                );
            });
        }).then(() => {
            console.log('[SW] All assets cached successfully');
            return self.skipWaiting(); // Activate immediately
        })
    );
});

// ─── Activate: Clean old caches ─────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating BBQ Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log(`[SW] Deleting old cache: ${name}`);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            return self.clients.claim(); // Take control of all pages
        })
    );
});

// ─── Fetch: Cache-first for assets, network-first for API ───────
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip WebSocket and API requests (never cache these)
    if (url.pathname.startsWith('/ws') ||
        url.pathname.startsWith('/api/') ||
        event.request.url.startsWith('ws://') ||
        event.request.url.startsWith('wss://')) {
        return;
    }

    // Skip la librería y los pesos del modelo on-device (WebLLM maneja su propia caché;
    // son archivos enormes que no deben pasar por este cache).
    if (url.hostname.includes('huggingface.co') ||
        url.hostname.includes('esm.run') ||
        url.href.includes('web-llm') ||
        url.href.includes('mlc-ai') ||
        url.href.includes('onnxruntime') ||
        url.href.includes('ort-wasm') ||
        url.href.includes('piper') ||
        url.pathname.endsWith('.wasm') ||
        url.pathname.endsWith('.onnx')) {
        return;
    }

    // For navigation requests (HTML pages), try network first then cache
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Clone and cache the fresh response
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => {
                    // Offline: serve from cache
                    return caches.match(event.request) || caches.match('/index.html');
                })
        );
        return;
    }

    // For all other assets: Cache-first, network fallback
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Serve from cache, but also update cache in background
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        caches.open(CACHE_NAME).then(cache => 
                            cache.put(event.request, networkResponse)
                        );
                    }
                }).catch(() => {}); // Ignore network errors during background update

                return cachedResponse;
            }

            // Not in cache: fetch from network and cache it
            return fetch(event.request).then((response) => {
                if (response && response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // Return a minimal offline response for missing resources
                if (event.request.destination === 'image') {
                    return new Response('', { status: 200, headers: { 'Content-Type': 'image/svg+xml' } });
                }
                return new Response('Offline', { status: 503, statusText: 'Offline' });
            });
        })
    );
});

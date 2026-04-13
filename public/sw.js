// HavenFlow Service Worker
// Provides offline support (network-first) and handles Web Push notifications.

const CACHE_NAME = "havenflow-v1"

// Pages to cache for offline viewing
const CACHE_PAGES = ["/dashboard", "/transactions", "/inventory", "/shopping-list", "/budgets"]

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener("install", () => {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting()
})

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
      )
  )
  // Take control of all open clients immediately
  self.clients.claim()
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Only handle same-origin GET requests
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return

  // Never cache auth or API routes (always network)
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/api/auth")) return

  // Static Next.js chunks — cache-first (they are content-hashed)
  if (url.pathname.startsWith("/_next/static")) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ??
          fetch(event.request).then((res) => {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone))
            return res
          })
      )
    )
    return
  }

  // Page navigations — network first, fall back to cache
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // Cache the page if it is one of our offline-support pages
          if (CACHE_PAGES.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"))) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone))
          }
          return res
        })
        .catch(() => caches.match(event.request))
    )
  }
})

// ── Push ──────────────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  /** @type {{ title?: string; body?: string; url?: string }} */
  const data = event.data ? event.data.json() : {}

  event.waitUntil(
    self.registration.showNotification(data.title ?? "HavenFlow", {
      body: data.body ?? "",
      icon: "/icons/icon.svg",
      badge: "/icons/icon.svg",
      tag: "havenflow-notification",
      renotify: true,
      data: { url: data.url ?? "/dashboard" },
    })
  )
})

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url ?? "/dashboard"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If there is already an open window, focus it
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})

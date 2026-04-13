"use client"

import { useEffect, useState, useTransition } from "react"
import { Bell, BellOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"

/**
 * Registers the service worker on mount and manages push notification subscriptions.
 * Must be rendered inside a client component tree (e.g. dashboard layout).
 */
export function PwaInit() {
  // Lazy initializer: detect push support once on client mount (avoids SSR issues)
  const [supported] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return "serviceWorker" in navigator && "PushManager" in window
  })
  const [subscribed, setSubscribed] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.warn("[SW] Registration failed:", err))
    }

    // Check if already subscribed (async callback — not synchronous in effect body)
    if (!supported) return
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {/* ignore */})
  }, [supported])

  async function handleSubscribeToggle() {
    const reg = await navigator.serviceWorker.ready

    if (subscribed) {
      // Unsubscribe
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
      }
      setSubscribed(false)
      toast("Notifications disabled", { variant: "default" })
      return
    }

    // Get VAPID public key from server
    const res = await fetch("/api/push/subscribe")
    if (!res.ok) {
      toast("Push notifications not available", { variant: "error" })
      return
    }
    const { vapidPublicKey } = (await res.json()) as { vapidPublicKey: string }

    // Ask permission
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      toast("Notification permission denied", { variant: "error" })
      return
    }

    // Subscribe
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })

    // Save to server
    const saveRes = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub),
    })

    if (saveRes.ok) {
      setSubscribed(true)
      toast("Notifications enabled!", { variant: "success" })
    } else {
      toast("Failed to save subscription", { variant: "error" })
    }
  }

  if (!supported) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isPending}
      onClick={() => startTransition(() => { void handleSubscribeToggle() })}
      aria-label={subscribed ? "Disable push notifications" : "Enable push notifications"}
      title={subscribed ? "Notifications on" : "Enable notifications"}
    >
      {subscribed ? (
        <Bell className="size-4 text-primary" />
      ) : (
        <BellOff className="size-4 text-muted-foreground" />
      )}
    </Button>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert VAPID public key from base64url string to Uint8Array */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer
}

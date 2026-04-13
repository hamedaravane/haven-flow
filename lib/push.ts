import webpush from "web-push"

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@havenflow.local"

// Configure web-push once on module load (keys are optional — push degrades gracefully)
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

/**
 * The VAPID public key is sent to the browser so it can create a push subscription.
 * Exposed via `/api/push/subscribe` GET response.
 */
export { vapidPublicKey }

export interface PushPayload {
  title: string
  body: string
  /** URL to open when the user clicks the notification */
  url?: string
}

export interface PushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Send a single Web Push notification.
 * Returns true on success, false on failure or missing VAPID config.
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    return false
  }
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    )
    return true
  } catch (err) {
    // 410 / 404 means the subscription is gone — callers should delete it
    console.error("[push] sendNotification failed:", err)
    return false
  }
}

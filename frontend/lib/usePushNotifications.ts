"use client";

import { useEffect, useRef } from "react";

export function usePushNotifications() {
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (subscribedRef.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    (async () => {
      try {
        // Register service worker
        const reg = await navigator.serviceWorker.register("/sw.js");

        // Get VAPID public key
        const keyRes = await fetch("/api/push/vapid-key");
        if (!keyRes.ok) return;
        const { publicKey } = await keyRes.json();
        if (!publicKey) return;

        // Check current permission
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return;

        // Subscribe
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
          });
        }

        // Send subscription to backend
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });

        subscribedRef.current = true;
      } catch {
        // Silent: push not critical
      }
    })();
  }, []);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

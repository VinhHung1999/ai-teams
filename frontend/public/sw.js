// AI Teams Service Worker — [352] Web Push
const CACHE_NAME = "ai-teams-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Web Push notification handler
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { return; }

  const title = data.title || "AI Teams";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    data: { projectId: data.projectId, url: "/chat" },
    tag: `ai-teams-${data.projectId}`, // replace per-project so notifications don't pile up
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// [375] Notification click — deeplink to the specific team chat
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const projectId = event.notification.data?.projectId;
  const targetUrl = projectId ? `/chat?team=${projectId}` : "/chat";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Find existing /chat tab and postMessage the projectId to it
      for (const client of clients) {
        if (client.url.includes("/chat") && "focus" in client) {
          if (projectId) client.postMessage({ type: "select-team", projectId });
          return client.focus();
        }
      }
      // No existing /chat tab — open with ?team param
      return self.clients.openWindow(targetUrl);
    })
  );
});

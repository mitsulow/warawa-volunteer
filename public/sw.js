// 最小限のService Worker（PWAインストール要件 + 簡易オフライン）
const CACHE = "warawa-v2";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// プッシュ通知の受信: 通知表示 + アイコンバッジ更新
self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {}
  e.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || "わらわ〜ボランティア", {
        body: data.body || "",
        icon: "/icon-192.png",
        // Androidのステータスバー用モノクロ小アイコン（白+透明のワラエル。scripts/make_badge.py）
        badge: "/badge-96.png",
        tag: data.tag || "warawa",
        data: { url: data.url || "/talk" },
      });
      if (typeof data.unread === "number" && "setAppBadge" in self.navigator) {
        try {
          if (data.unread > 0) await self.navigator.setAppBadge(data.unread);
          else await self.navigator.clearAppBadge();
        } catch {}
      }
    })()
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/talk";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// ネットワーク優先・失敗時のみキャッシュ（APIやSupabaseは素通し）
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && e.request.mode === "navigate") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((m) => m || caches.match("/")))
  );
});

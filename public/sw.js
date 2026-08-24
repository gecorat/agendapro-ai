// Service worker de Kame Agenda — solo se encarga de mostrar notificaciones push cuando
// llegan del servidor (VAPID/Web Push) y de llevarte a la pantalla correcta al tocarlas.
// A propósito NO implementa cache-first/offline: la app en sí sigue siendo 100% online,
// esto es puramente para que las notificaciones lleguen aunque la app esté cerrada.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Kame Agenda", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Kame Agenda";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Si ya hay una pestaña/ventana de la app abierta, la enfoca y navega ahí en vez de abrir
// una nueva — así no se te acumulan pestañas duplicadas cada vez que tocás una notificación.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.postMessage({ type: "NOTIFICATION_NAVIGATE", url: targetUrl });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

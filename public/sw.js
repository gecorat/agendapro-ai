// Service worker de Kame Agenda — solo se encarga de mostrar notificaciones push cuando
// llegan del servidor (VAPID/Web Push) y de llevarte a la pantalla correcta al tocarlas.
// A propósito NO implementa cache-first/offline: la app en sí sigue siendo 100% online,
// esto es puramente para que las notificaciones lleguen aunque la app esté cerrada.

// Mismo ícono chico embebido que usa el resto de la app (favicon / logo del sidebar) —
// así no depende de que exista un archivo estático aparte en /public que nadie generó.
const ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAn1BMVEUAAAAKnrcKXbUVYqYsmrIIn8QGYMVjnKY0pGEmY6EbZKoEfX9Np7c2lrAA//8NzMULw7kNq6sABvj17Oxik20AcPNFm2h2enuip6RQysNWdJumzMf/9GwAAH9u8fDkrqQHPqshqGszwbpGl2tTtMGknWr/uNv/1LoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABbBQPPAAAAKHRSTlMA9/IRnP7+I/FeoQJaZgH69QQBCCQCoAcRYB0bBQIRCg0EqmhbCQcKZqul9gAAAqNJREFUeNqNlIdy4zAMRMEmikVdihyXOD3//4e3IFXsSSY5zDhW5KcFFgBF9GvU3U93VReIgnq64YhOj4gTXy3R9dtl2LlPahtEO6ygwsdWWgihtaXl+boedPNITds2e5JzJbbQQ5gZfaHYiNcWATznOt5gQhjN9zoKg2hFk8DMzWSFkbdkvA78g27wT9u8Pq6pw+ykMcLgs+fXcUnTvsLMZhBOEFVkvSRqmvUR+H4ie+OacQ1KR6FPMeoVbJpIe29rpRRpqFVfFJOb/BSChrux9GqAhv7CZTSRaEJV78ydaMu7jANcTNWyrrU0lmO61dV3cyYn0SFrdTJjTBzL8mEQjaa7vaiDlUVVMSHigU6VtuCIKiMGqu8EfeGJvOBJE+9HWZYj6kCS7nadeiulharEGql6DgeAo+26T0wJy7E7JseCzrg0J0pcxU1Ci/R1TY5GfPjCPZOUh/FhxNY8lOUbwXFaPCNOYcjc7KWUY1LNpSUj2izDR//rxClZAHSgLb2BhF75SQMP8z1PMaLnl0vm0h9YZgqqIQ/yfV3QjiY0hjnprCtcrg/ZO2S2ipZxC67xmDA2fZQeDT2wEUUWMr1dN4hBl7ICnK5SnkldRhihgzaRBXU0GwjMUSFTEf647KXEKAkjPVQJ5KVyHl1WUiqaIV1I75DDSN45YSrK4DYaiDmShUOPEqzOPGZwdZVd4wj0k+Il4zp5gOeYuoTskMQP6RTFddcU52bj0FbMWxxLWZGq+0POPO9bhh55d/w4Y5CpAPhCvg6OzLa8PU+Rc+fW87dPUNLQwq6n5pmb6T6U93mS0tt8urLKfrYupJaDffVJEjVP39+C22kIqld5PdYXwncyqBtPLPjrC7unkPTcH9zSdv+XHis+Owdoov+KKfx4+x9zVR72ndTOfwAAAABJRU5ErkJggg==";

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
    icon: ICON,
    badge: ICON,
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

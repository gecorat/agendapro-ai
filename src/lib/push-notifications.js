import { base44 } from "@/api/base44Client";

// La clave pública VAPID viaja como base64 URL-safe; PushManager.subscribe necesita un
// Uint8Array — esta es la conversión estándar recomendada por la spec de Web Push.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

// Idempotente: registrar un service worker ya registrado no hace nada raro, así que se
// puede llamar en cada carga de la app sin cuidado especial.
export async function registerServiceWorker() {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (e) {
    console.error("No se pudo registrar el service worker:", e);
    return null;
  }
}

// Se llama DESPUÉS de que el navegador ya dio permiso de notificaciones
// (Notification.permission === "granted"): arma la suscripción push real del navegador y
// la manda a guardar al backend. Si ya había una suscripción activa en este dispositivo, la
// reutiliza (no crea una nueva cada vez que se llama).
export async function subscribeToPush() {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const res = await base44.functions.invoke("getVapidPublicKey", {});
      const publicKey = res?.data?.publicKey;
      if (!publicKey) return false; // el admin todavía no configuró las claves VAPID
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    const json = subscription.toJSON();
    await base44.functions.invoke("savePushSubscription", {
      endpoint: json.endpoint,
      keys: json.keys,
      user_agent: navigator.userAgent,
    });
    return true;
  } catch (e) {
    console.error("No se pudo suscribir a notificaciones push:", e);
    return false;
  }
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await base44.functions.invoke("removePushSubscription", { endpoint });
    }
  } catch (e) {
    console.error("No se pudo desuscribir de notificaciones push:", e);
  }
}

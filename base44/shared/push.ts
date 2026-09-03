import webpush from 'npm:web-push@3.6.7';
import { ownerIdOf } from './ownership.ts';

// Helper compartido de Web Push (VAPID). Cualquier función de servidor que quiera avisarle
// a un profesional algo mientras el teléfono está bloqueado / la app cerrada, usa esto.
// Si el admin todavía no configuró las claves VAPID en PlatformConfig, sendPushToUsers no
// rompe nada — simplemente no manda nada (igual que evolution_base_url/zernio_api_key sin
// configurar en los otros proveedores).

let vapidConfigured = null; // cachea el par de claves ya usado en este proceso

async function getVapidConfig(base44) {
  const cfgRows = await base44.asServiceRole.entities.PlatformConfig.filter({});
  const cfg = cfgRows?.[0];
  if (!cfg?.vapid_public_key || !cfg?.vapid_private_key) return null;
  if (vapidConfigured !== cfg.vapid_public_key) {
    webpush.setVapidDetails('mailto:soporte@kameagenda.com', cfg.vapid_public_key, cfg.vapid_private_key);
    vapidConfigured = cfg.vapid_public_key;
  }
  return cfg;
}

// payload: { title, body, url?, tag? } — se manda tal cual como JSON al service worker,
// que es quien arma la notificación real (ver public/sw.js).
export async function sendPushToUsers(base44, userIds, payload) {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
  if (uniqueIds.length === 0) return;

  const cfg = await getVapidConfig(base44);
  if (!cfg) return;

  const subs = await base44.asServiceRole.entities.PushSubscription.filter({ user_id: { $in: uniqueIds } });
  if (!subs || subs.length === 0) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
          body
        );
      } catch (err) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          // Suscripción vencida o el navegador la invalidó (ej. el usuario la borró desde
          // su lado) — la limpiamos para no seguir intentando en vano.
          try {
            await base44.asServiceRole.entities.PushSubscription.delete(sub.id);
          } catch { /* no bloquea el resto de los envíos */ }
        } else {
          console.error('sendPushToUsers error:', err?.message || err);
        }
      }
    })
  );
}

// A quién avisarle de un consultorio: el dueño de la cuenta + cualquier profesional activo
// del equipo (plan Clinic). Todos reciben las mismas notificaciones por ahora — no hay
// segmentación por profesional puntual todavía.
export async function getPracticeRecipientUserIds(base44, practice) {
  // ownerIdOf, no created_by_id: en las cuentas creadas por el onboarding ese campo es el
  // id del servicio, así que el aviso push no le llegaba al dueño (ver ownership.ts).
  const ownerId = ownerIdOf(practice);
  const ids = [ownerId];
  try {
    const pros = await base44.asServiceRole.entities.Professional.filter({
      practice_owner_id: ownerId,
      active: true,
    });
    for (const p of pros || []) if (p.user_id) ids.push(p.user_id);
  } catch {
    // si falla, seguimos con al menos el dueño
  }
  return [...new Set(ids.filter(Boolean))];
}

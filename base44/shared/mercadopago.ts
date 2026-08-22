// Lógica compartida entre el webhook de Mercado Pago (reacciona al toque, cuando llega el
// aviso) y el chequeo periódico (red de seguridad, por si el aviso nunca llega — confirmado
// en vivo que puede pasar: un pago se acreditó y Mercado Pago nunca mandó la notificación).
// Ambos caminos hacen lo mismo: nunca confían en nada que no sea el estado real consultado
// directo a la API de Mercado Pago.
export async function syncSubscriptionStatus(base44, accessToken, resourceId) {
  const res = await fetch(`https://api.mercadopago.com/preapproval/${resourceId}`, {    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { synced: false, reason: "fetch_failed" };
  const preapproval = await res.json();

  let ref = {};
  try {
    ref = JSON.parse(preapproval.external_reference || "{}");
  } catch { /* ignore */ }

  const practices = ref.practice_id
    ? await base44.asServiceRole.entities.PracticeSettings.filter({ id: ref.practice_id })
    : await base44.asServiceRole.entities.PracticeSettings.filter({ mercadopago_subscription_id: resourceId });
  const practice = practices?.[0];
  if (!practice) return { synced: false, reason: "no_matching_practice" };

  if (preapproval.status === "authorized") {
    const targetPlan = ref.plan || practice.plan;
    if (practice.plan !== targetPlan || practice.suspended) {
      await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
        plan: targetPlan,
        suspended: false,
        mercadopago_subscription_id: resourceId,
      });
      return { synced: true, changed: true, status: preapproval.status, practice_id: practice.id };
    }
    return { synced: true, changed: false, status: preapproval.status, practice_id: practice.id };
  }

  if (preapproval.status === "cancelled" || preapproval.status === "paused") {
    if (!practice.suspended) {
      await base44.asServiceRole.entities.PracticeSettings.update(practice.id, { suspended: true });
      return { synced: true, changed: true, status: preapproval.status, practice_id: practice.id };
    }
    return { synced: true, changed: false, status: preapproval.status, practice_id: practice.id };
  }

  return { synced: true, changed: false, status: preapproval.status, practice_id: practice.id };
}

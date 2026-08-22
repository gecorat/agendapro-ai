import { PLAN_PRICES } from "./plan.ts";

// $10.000/mes por cada profesional que supere los 3 incluidos en el plan Clinic.
// Confirmado con el due\u00f1o de la cuenta.
export const PROFESSIONAL_ADDON_PRICE = 10000;
export const CLINIC_FREE_PROFESSIONALS = 3;

// Recalcula cu\u00e1nto deber\u00eda estar cobr\u00e1ndose por mes (plan base + addons) y actualiza el
// monto real de la suscripci\u00f3n en Mercado Pago si cambi\u00f3 \u2014 confirmado que
// PUT /preapproval/{id} permite modificar auto_recurring.transaction_amount de una
// suscripci\u00f3n YA activa, sin tener que crear una nueva.
export async function syncProfessionalAddonBilling(base44, practice) {
  if (!practice?.mercadopago_subscription_id) return { synced: false, reason: "sin_suscripcion" };

  const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
  const accessToken = cfg?.[0]?.mercadopago_access_token;
  if (!accessToken) return { synced: false, reason: "sin_token" };

  const professionals = await base44.asServiceRole.entities.Professional.filter({ practice_owner_id: practice.created_by_id });
  const addonCount = (professionals || []).filter((p) => p.is_paid_addon).length;
  const targetAmount = (PLAN_PRICES.clinic || 69000) + addonCount * PROFESSIONAL_ADDON_PRICE;

  try {
    const res = await fetch(`https://api.mercadopago.com/preapproval/${practice.mercadopago_subscription_id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ auto_recurring: { transaction_amount: targetAmount, currency_id: "ARS" } }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[syncProfessionalAddonBilling] Mercado Pago ${res.status}:`, errText);
      return { synced: false, reason: "mp_error", detail: errText };
    }
    return { synced: true, addonCount, targetAmount };
  } catch (e) {
    console.error("[syncProfessionalAddonBilling] error de red:", e?.message || e);
    return { synced: false, reason: "network_error" };
  }
}

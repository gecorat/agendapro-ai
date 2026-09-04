import { PLAN_PRICES, PLAN_LABELS } from './plan.ts';

// Suscripción "con plan asociado": en vez de crear una preapproval por usuario (lo que
// obliga a mandar payer_email en el POST — Mercado Pago lo exige siempre, es un campo
// REQUERIDO de su API, no hay forma de saltearlo llamando /preapproval directamente),
// creamos UN plan por tier (basic/pro/clinic) una sola vez, y usamos el init_point
// público del plan como link de checkout para cualquier usuario. Ahí es Mercado Pago
// quien le pide al usuario que inicie sesión con SU cuenta (o pague como invitado) — no
// nosotros. Los ids se cachean en PlatformConfig para no crear planes duplicados.
export async function getOrCreateMpPlanLinks(base44, accessToken, origin) {
  const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
  const platformConfig = cfg?.[0];
  let planIds = {};
  try {
    planIds = JSON.parse(platformConfig?.mercadopago_plan_ids || '{}');
  } catch { /* ignore */ }

  // A DONDE VUELVE EL USUARIO DESPUES DE PAGAR. Va el dominio configurado en
  // PlatformConfig (app_base_url), NO el `origin` del navegador que disparo el pago.
  //
  // Por que importa: los planes de Mercado Pago se crean UNA sola vez y quedan cacheados
  // con su back_url para siempre. Si el primer pago de la plataforma salia desde una
  // preview de Base44 (o desde localhost), TODOS los checkouts posteriores volvian a esa
  // URL — y como es ahi donde corre linkMpSubscription, la suscripcion nunca quedaba
  // vinculada a la cuenta: el profesional pagaba y se quedaba sin plan.
  const base = (platformConfig?.app_base_url || '').trim().replace(/\/+$/, '') || origin || 'https://kameagenda.com';
  const backUrl = `${base}/upgrade-plan?status=success`;
  let changed = false;

  for (const plan of Object.keys(PLAN_PRICES)) {
    if (planIds[plan]?.id && planIds[plan]?.init_point) continue;

    const res = await fetch('https://api.mercadopago.com/preapproval_plan', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: `Kame Agenda — Plan ${PLAN_LABELS[plan]}`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: PLAN_PRICES[plan],
          currency_id: 'ARS',
        },
        back_url: backUrl,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `No se pudo crear el plan de Mercado Pago para "${plan}"`);

    planIds[plan] = { id: data.id, init_point: data.init_point };
    changed = true;
  }

  if (changed) {
    if (platformConfig?.id) {
      await base44.asServiceRole.entities.PlatformConfig.update(platformConfig.id, {
        mercadopago_plan_ids: JSON.stringify(planIds),
      });
    } else {
      await base44.asServiceRole.entities.PlatformConfig.create({
        mercadopago_plan_ids: JSON.stringify(planIds),
      });
    }
  }

  return planIds;
}

// Lógica compartida entre el webhook de Mercado Pago (reacciona al toque, cuando llega el
// aviso) y el chequeo periódico (red de seguridad, por si el aviso nunca llega — confirmado
// en vivo que puede pasar: un pago se acreditó y Mercado Pago nunca mandó la notificación).
// Ambos caminos hacen lo mismo: nunca confían en nada que no sea el estado real consultado
// directo a la API de Mercado Pago.
export async function syncSubscriptionStatus(base44, accessToken, resourceId) {
  const res = await fetch(`https://api.mercadopago.com/preapproval/${resourceId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { synced: false, reason: "fetch_failed" };
  const preapproval = await res.json();

  const platformCfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
  const platform = platformCfg?.[0];

  let ref = {};
  try {
    ref = JSON.parse(preapproval.external_reference || "{}");
  } catch { /* ignore */ }

  const practices = ref.practice_id
    ? await base44.asServiceRole.entities.PracticeSettings.filter({ id: ref.practice_id })
    : await base44.asServiceRole.entities.PracticeSettings.filter({ mercadopago_subscription_id: resourceId });
  let practice = practices?.[0];

  // Rescate: suscripcion pagada que nunca quedo vinculada a una cuenta (ver
  // rescuePracticeByPayerEmail, mas arriba en este archivo).
  let rescuedPlan = null;
  if (!practice) {
    const rescued = await rescuePracticeByPayerEmail(base44, preapproval);
    if (!rescued) return { synced: false, reason: "no_matching_practice" };
    practice = rescued;
    rescuedPlan = rescued.mercadopago_pending_plan || null;
    await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
      mercadopago_subscription_id: resourceId,
      mercadopago_pending_plan: null,
    });
    practice = { ...practice, mercadopago_subscription_id: resourceId, mercadopago_pending_plan: null };
  }

  // Si un admin le asigno el plan a mano (por ejemplo, para probar sin cobrarse a si
  // mismo), el sync automatico NUNCA debe pisarlo — sin esto, una suscripcion vieja de
  // prueba enganchada a la cuenta podia revertir la decision manual del admin sin que
  // nadie se diera cuenta.
  if (practice.plan_granted_by_admin) {
    return { synced: true, changed: false, status: preapproval.status, practice_id: practice.id, reason: "admin_override" };
  }

  // El checkout "con plan asociado" no manda external_reference (es un link público
  // compartido por todos los suscriptores de ese plan, no lo generamos por request), así
  // que ref.plan viene vacío en ese caso. Como fallback, resolvemos el plan mirando a qué
  // preapproval_plan_id de Mercado Pago corresponde (cacheados en PlatformConfig).
  let targetPlan = ref.plan;
  if (!targetPlan && preapproval.preapproval_plan_id) {
    let planIds = {};
    try { planIds = JSON.parse(platform?.mercadopago_plan_ids || "{}"); } catch { /* ignore */ }
    targetPlan = Object.keys(planIds).find((p) => planIds[p]?.id === preapproval.preapproval_plan_id);
  }
  targetPlan = targetPlan || rescuedPlan || practice.plan;

  if (preapproval.status === "authorized") {
    // El día de alta de la suscripción es el día en que Mercado Pago cobra todos los
    // meses, así que es también el día en que se renueva el cupo de conversaciones (ver
    // getCycleStart en plan.ts). Lo guardamos acá — el único lugar donde vemos el
    // preapproval real — y así el chequeo horario también rellena las cuentas viejas.
    const anchorChanged = !!preapproval.date_created && practice.plan_cycle_anchor !== preapproval.date_created;
    if (practice.plan !== targetPlan || practice.suspended || anchorChanged) {
      await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
        plan: targetPlan,
        suspended: false,
        mercadopago_subscription_id: resourceId,
        ...(anchorChanged ? { plan_cycle_anchor: preapproval.date_created } : {}),
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

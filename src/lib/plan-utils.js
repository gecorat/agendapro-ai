export const TRIAL_DAYS = 14;
export const PLAN_PRICES = {
  basic: "$39.000",
  pro: "$119.000",
  premium: "$169.000",
};

export const PLAN_LABELS = {
  trial: "Prueba",
  basic: "Básico",
  pro: "Pro",
  premium: "Premium",
};

export function getPlanStatus(settings) {
  if (!settings) {
    return { plan: null, isTrial: false, trialExpired: false, hasPaidPlan: false, daysLeft: 0, canUseWhatsApp: false, active: false, loaded: false };
  }
  const plan = settings.plan || "trial";
  const isTrial = plan === "trial";
  const hasPaidPlan = plan === "basic" || plan === "pro" || plan === "premium";
  let trialExpired = false;
  let daysLeft = 0;
  if (isTrial && settings.trial_ends_at) {
    const end = new Date(settings.trial_ends_at);
    const now = new Date();
    trialExpired = end < now;
    daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
  }
  const suspended = settings.suspended === true;
  const canUseWhatsApp = hasPaidPlan && !suspended;
  const active = (!isTrial || !trialExpired) && !suspended;
  return { plan, isTrial, trialExpired, hasPaidPlan, daysLeft, canUseWhatsApp, active, suspended, loaded: true };
}
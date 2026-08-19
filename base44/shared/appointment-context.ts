// Arma los datos comunes que van en los emails/WhatsApp de citas (confirmación y
// recordatorios): nombre del profesional que atiende (resuelve el equipo en plan Clinic)
// y la dirección completa del consultorio.
export async function getAppointmentContext(base44, appt, practice) {
  let professionalName = practice?.practice_name || "";
  if (appt.professional_ref_id) {
    try {
      const pros = await base44.asServiceRole.entities.Professional.filter({ id: appt.professional_ref_id });
      const pro = pros?.[0];
      if (pro) {
        const name = `${pro.first_name || ""} ${pro.last_name || ""}`.trim();
        if (name) professionalName = name;
      }
    } catch { /* si falla, seguimos con el nombre del consultorio */ }
  }
  const address = [practice?.address, practice?.address_city, practice?.address_province].filter(Boolean).join(", ");
  return { professionalName, address };
}

export function whatsappLink(phone, message) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

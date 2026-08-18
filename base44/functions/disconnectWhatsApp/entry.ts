import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Acción explícita y auditable para desconectar WhatsApp, en vez de dejar que el cliente
// escriba directo los campos de conexión de Zernio (bloqueados por RLS para no-admins).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const existing = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: user.id });
    const practice = existing?.[0];
    if (!practice) return Response.json({ error: 'No hay configuración de consultorio' }, { status: 400 });

    const updated = await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
      whatsapp_connected: false,
      zernio_account_id: '',
      zernio_phone: '',
    });
    return Response.json({ settings: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

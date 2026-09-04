import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ownerIdOf } from '../../shared/ownership.ts';

// Borra una ficha de consultorio HUERFANA: una fila de PracticeSettings cuyo usuario dueno
// ya no existe. Quedan cuando se borra un usuario y su consultorio no, o cuando un alta
// fallo por el bug de propiedad de created_by_id (ver base44/shared/ownership.ts).
//
// No habia forma de limpiarlas: la pantalla de Usuarios del panel lista USUARIOS, y estas
// filas justamente no tienen ninguno detras, asi que no aparecian en ningun lado.
//
// SEGURIDAD: no alcanza con que el cliente diga que es huerfana. Se vuelve a verificar aca,
// contra la lista real de usuarios, y si la ficha SI tiene dueno se rechaza el borrado. Asi
// este endpoint nunca puede usarse para borrar la cuenta de un profesional activo, ni por
// error ni a proposito.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Solo un administrador puede hacer esto' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const practiceId = body?.practice_id;
    if (!practiceId) return Response.json({ error: 'Falta practice_id' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.PracticeSettings.filter({ id: practiceId });
    const practice = rows?.[0];
    if (!practice) return Response.json({ ok: true, deleted: false, reason: 'not_found' });

    const ownerId = ownerIdOf(practice);
    const users = await base44.asServiceRole.entities.User.filter({});
    const ownerExists = (users || []).some((u: any) => u.id === ownerId);
    if (ownerExists) {
      return Response.json(
        { error: 'Esa ficha tiene un usuario activo: no es huerfana y no se puede borrar desde aca.' },
        { status: 400 },
      );
    }

    // Se borra SOLO la ficha del consultorio. Los servicios y horarios sueltos que hayan
    // quedado NO se tocan a proposito: en las cuentas rotas su created_by_id es el id
    // COMPARTIDO del servicio, asi que borrar por ese campo se llevaria puestos los datos
    // de otras cuentas. Sin la ficha ya no son alcanzables por ninguna pantalla.
    await base44.asServiceRole.entities.PracticeSettings.delete(practice.id);

    return Response.json({
      ok: true,
      deleted: true,
      practice_name: practice.practice_name || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

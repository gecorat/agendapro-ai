import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// PlatformConfig es de lectura solo para admins, así que el frontend (cualquier
// profesional editando su perfil, o un visitante público) no puede leer la API key
// directo. Esta función se la expone — es seguro porque las keys de Google Maps para
// frontend están pensadas para viajar visibles en el navegador; la protección real es la
// restricción por dominio (HTTP referrer) que se configura en Google Cloud Console.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const cfgList = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const apiKey = cfgList?.[0]?.google_maps_api_key || '';
    return Response.json({ apiKey });
  } catch (error) {
    return Response.json({ apiKey: '' });
  }
}

export async function getAppUrl(base44: any, req: Request): Promise<string> {
  // 1. Dominio público configurado por el admin en PlatformConfig
  try {
    const list = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const cfg = list?.[0];
    const configured = (cfg?.app_base_url || "").trim();
    if (configured) return configured.replace(/\/+$/, "");
  } catch {}
  // 2. Fallback al origin del request
  try {
    const u = new URL(req.url);
    return u.origin;
  } catch {
    return "https://app.agendapro.com";
  }
}

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildEmailHtml({
  title,
  greeting,
  lines,
  primaryButton,
  secondaryButton,
  footer,
}: {
  title: string;
  greeting?: string;
  lines: string[];
  primaryButton?: { label: string; url: string };
  secondaryButton?: { label: string; url: string };
  footer?: string;
}): string {
  const greetingHtml = greeting ? `<p style="margin:0 0 16px;font-size:16px;color:#1e293b;">${escapeHtml(greeting)}</p>` : "";
  const linesHtml = lines
    .map(
      (l) =>
        `<p style="margin:0 0 8px;font-size:15px;color:#475569;line-height:1.6;">${escapeHtml(l)}</p>`
    )
    .join("");

  const primaryHtml = primaryButton
    ? `<a href="${escapeHtml(primaryButton.url)}" style="display:inline-block;background:#059669;color:#ffffff;font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;margin:8px 8px 8px 0;">${escapeHtml(primaryButton.label)}</a>`
    : "";
  const secondaryHtml = secondaryButton
    ? `<a href="${escapeHtml(secondaryButton.url)}" style="display:inline-block;background:#f1f5f9;color:#334155;font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;border:1px solid #e2e8f0;">${escapeHtml(secondaryButton.label)}</a>`
    : "";

  const buttonsHtml =
    primaryHtml || secondaryHtml
      ? `<div style="margin:24px 0 8px;">${primaryHtml}${secondaryHtml}</div>`
      : "";

  const footerText = footer || "AgendaPro";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
<tr>
<td style="background:#0f172a;padding:24px 32px;text-align:center;">
<span style="font-family:Inter,Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">AgendaPro</span>
</td>
</tr>
<tr>
<td style="padding:32px;">
<h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">${escapeHtml(title)}</h1>
${greetingHtml}
${linesHtml}
${buttonsHtml}
</td>
</tr>
<tr>
<td style="padding:20px 32px;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">${escapeHtml(footerText)}</p>
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
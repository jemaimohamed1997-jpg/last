function sendJson(res: any, statusCode: number, payload: Record<string, any>) {
  if (typeof res?.status === 'function' && typeof res?.json === 'function') {
    return res.status(statusCode).json(payload);
  }
  res.statusCode = statusCode;
  if (typeof res?.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
  }
  res.end(JSON.stringify(payload));
}

export default async function handler(_req: any, res: any) {
  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const viteSupabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim();
  const effectiveUrl = (supabaseUrl || viteSupabaseUrl).replace(/\/rest\/v1\/?$/, '');
  const serviceRoleKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  ).trim();

  return sendJson(res, 200, {
    ok: true,
    status: 'ok',
    service: 'huilerie-jemai-erp',
    runtime: process.env.VERCEL ? 'vercel-serverless' : 'node-server',
    nodeVersion: process.version,
    env: {
      hasSupabaseUrl: Boolean(effectiveUrl),
      hasViteSupabaseUrl: Boolean(viteSupabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    },
    timestamp: new Date().toISOString(),
  });
}

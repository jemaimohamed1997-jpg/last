import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import adminUsersHandler from './api/admin/users.ts';
import movementHandler from './api/movement.ts';
import healthHandler from './api/health.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getHealthSupabaseClient() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/rest\/v1\/?$/, '');
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  if (!url || !key) return null;
  return { url, client: createClient(url, key, { auth: { persistSession: false } }) };
}

async function startServer() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';
  const PORT = Number(process.env.PORT) || (isProd ? 8080 : Number(process.env.DEV_PORT) || 3000);

  app.use(express.json({ limit: '10mb' }));

  app.get('/healthz', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'huilerie-jemai-erp',
      mode: isProd ? 'production' : 'development',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/health', (req, res) => healthHandler(req, res));

  app.get('/api/supabase/status', async (_req, res) => {
    const supa = getHealthSupabaseClient();
    if (!supa) {
      return res.status(200).json({
        success: false,
        configured: false,
        canRead: false,
        readError: 'Variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes.',
        timestamp: new Date().toISOString(),
      });
    }
    try {
      const { error } = await supa.client.from('tanks').select('id').limit(1);
      return res.status(200).json({
        success: !error,
        configured: true,
        url: supa.url,
        canRead: !error,
        readError: error?.message || null,
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) {
      return res.status(200).json({
        success: false,
        configured: true,
        url: supa.url,
        canRead: false,
        readError: e?.message || 'Erreur réseau',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Admin user & RBAC management (uses SUPABASE_SERVICE_ROLE_KEY)
  app.all('/api/admin/users', (req, res) => adminUsersHandler(req, res));

  // Backward-compatible movement endpoints (/api/movement + legacy aliases)
  app.post(['/api/movement', '/api/mouvement', '/api/mouvements', '/api/movements'], (req, res) =>
    movementHandler(req, res)
  );

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({ success: false, error: 'Endpoint API non trouvé' });
        }
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur Huilerie Jemai ERP démarré sur http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Erreur démarrage serveur:', err);
  process.exit(1);
});

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

type ModuleKey =
  | 'RECEPTIONS'
  | 'PRODUCTION'
  | 'GRIGNONS'
  | 'PURCHASES'
  | 'CUVES'
  | 'FINANCES'
  | 'CUSTOMER_HISTORY'
  | 'CLIENTS'
  | 'PERSONNEL'
  | 'SETTINGS';

const MODULE_ACTIONS: Record<ModuleKey, string[]> = {
  RECEPTIONS: ['view', 'create', 'edit', 'pay', 'export'],
  PRODUCTION: ['view', 'create', 'edit', 'confirm', 'export'],
  GRIGNONS: ['view', 'create', 'edit', 'pay', 'export'],
  PURCHASES: ['view', 'create', 'edit', 'pay', 'export'],
  CUVES: ['view', 'create', 'edit', 'cancel', 'export'],
  FINANCES: ['view', 'create', 'edit', 'export'],
  CUSTOMER_HISTORY: ['view', 'edit', 'export'],
  CLIENTS: ['view', 'create', 'edit', 'export'],
  PERSONNEL: ['view', 'create', 'edit', 'pay', 'export'],
  SETTINGS: ['view', 'edit', 'admin'],
};

const ADMIN_FULL_PERMISSIONS: Record<string, Record<string, boolean>> = {
  RECEPTIONS: { view: true, create: true, edit: true, pay: true, export: true },
  PRODUCTION: { view: true, create: true, edit: true, confirm: true, export: true },
  GRIGNONS: { view: true, create: true, edit: true, pay: true, export: true },
  PURCHASES: { view: true, create: true, edit: true, pay: true, export: true },
  CUVES: { view: true, create: true, edit: true, cancel: true, export: true },
  FINANCES: { view: true, create: true, edit: true, export: true },
  CUSTOMER_HISTORY: { view: true, edit: true, export: true },
  CLIENTS: { view: true, create: true, edit: true, export: true },
  PERSONNEL: { view: true, create: true, edit: true, pay: true, export: true },
  SETTINGS: { view: true, edit: true, admin: true },
};

const DEFAULT_OPERATOR_PERMISSIONS: Record<string, Record<string, boolean>> = {
  RECEPTIONS: { view: true, create: true, edit: false, pay: true, export: true },
  PRODUCTION: { view: true, create: true, edit: false, confirm: false, export: true },
  GRIGNONS: { view: true, create: true, edit: false, pay: true, export: true },
  PURCHASES: { view: true, create: true, edit: false, pay: false, export: true },
  CUVES: { view: true, create: true, edit: false, cancel: false, export: true },
  FINANCES: { view: false, create: false, edit: false, export: false },
  CUSTOMER_HISTORY: { view: true, edit: true, export: true },
  CLIENTS: { view: true, create: true, edit: false, export: true },
  PERSONNEL: { view: false, create: false, edit: false, pay: false, export: false },
  SETTINGS: { view: false, edit: false, admin: false },
};

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

async function readJsonBody(req: any): Promise<Record<string, any>> {
  const rawBody = req?.body;
  if (rawBody !== undefined && rawBody !== null) {
    if (typeof rawBody === 'string') {
      return rawBody.trim() ? JSON.parse(rawBody) : {};
    }
    if (rawBody instanceof Uint8Array) {
      const decoded = new TextDecoder().decode(rawBody);
      return decoded.trim() ? JSON.parse(decoded) : {};
    }
    if (typeof rawBody === 'object') {
      return rawBody;
    }
    return {};
  }

  if (req && typeof req[Symbol.asyncIterator] === 'function') {
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      if (typeof chunk === 'string') {
        chunks.push(new TextEncoder().encode(chunk));
      } else if (chunk instanceof Uint8Array) {
        chunks.push(chunk);
      }
    }
    const totalLen = chunks.reduce((acc, c) => acc + c.byteLength, 0);
    if (totalLen === 0) return {};
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    const text = new TextDecoder().decode(merged).trim();
    return text ? JSON.parse(text) : {};
  }

  return {};
}

function normalizePermissionsMatrix(
  role: 'admin' | 'operateur',
  rawPermissions?: Record<string, any> | null
): Record<string, Record<string, boolean>> {
  if (role === 'admin') {
    return JSON.parse(JSON.stringify(ADMIN_FULL_PERMISSIONS));
  }

  const source =
    rawPermissions && typeof rawPermissions === 'object' && !Array.isArray(rawPermissions)
      ? rawPermissions
      : DEFAULT_OPERATOR_PERMISSIONS;

  const normalized: Record<string, Record<string, boolean>> = {};
  (Object.keys(MODULE_ACTIONS) as ModuleKey[]).forEach((modKey) => {
    const allowedActions = MODULE_ACTIONS[modKey];
    const modInput =
      source[modKey] && typeof source[modKey] === 'object' ? source[modKey] : {};

    const entry: Record<string, boolean> = {};
    let anyNonViewEnabled = false;
    for (const act of allowedActions) {
      const val = Boolean(modInput[act]);
      entry[act] = val;
      if (act !== 'view' && val) {
        anyNonViewEnabled = true;
      }
    }
    if (anyNonViewEnabled) {
      entry.view = true;
    }
    if (!entry.view) {
      for (const act of allowedActions) {
        entry[act] = false;
      }
    }
    normalized[modKey] = entry;
  });

  return normalized;
}

function normalizeUsername(raw: string, email: string): string {
  const base = (raw || email.split('@')[0] || 'utilisateur')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '');
  return base || `user_${Date.now()}`;
}

function getServerSupabaseAdmin(): {
  client: any | null;
  missingVars: string[];
} {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/rest\/v1\/?$/, '');
  const serviceKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  ).trim();

  const missingVars: string[] = [];
  if (!url) missingVars.push('SUPABASE_URL (ou VITE_SUPABASE_URL)');
  if (!serviceKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missingVars.length > 0) {
    return { client: null, missingVars };
  }

  return {
    client: createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    missingVars: [],
  };
}

async function findAuthUserByEmail(adminClient: any, email: string): Promise<any | null> {
  let page = 1;
  const perPage = 200;
  const target = email.trim().toLowerCase();

  while (page <= 20) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) return null;
    const match = data.users.find(
      (u: any) => String(u.email || '').trim().toLowerCase() === target
    );
    if (match) return match;
    if (data.users.length < perPage) return null;
    page += 1;
  }
  return null;
}

async function rollbackAuthUserCreation(adminClient: any, authUserId: string): Promise<void> {
  try {
    const { error } = await adminClient.auth.admin.deleteUser(authUserId);
    if (error) {
      await adminClient.auth.admin.deleteUser(authUserId);
    }
  } catch (err) {
    console.error('Rollback auth user failed:', authUserId, err);
  }
}

async function verifyAdminCaller(
  req: any,
  adminClient: any
): Promise<{ ok: boolean; status: number; error?: string; callerProfile?: any }> {
  const authHeader = String(req?.headers?.authorization || req?.headers?.Authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return { ok: false, status: 401, error: 'Jeton d’authentification manquant.' };
  }

  const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return {
      ok: false,
      status: 401,
      error: userErr?.message
        ? `Session invalide ou expirée (${userErr.message}).`
        : 'Session invalide ou expirée.',
    };
  }

  const { data: rows, error: profErr } = await adminClient
    .from('profiles')
    .select('*')
    .eq('auth_user_id', userData.user.id)
    .limit(1);

  if (profErr) {
    return {
      ok: false,
      status: 500,
      error: `Erreur lecture profil administrateur dans Supabase : ${profErr.message}`,
    };
  }

  const profile = Array.isArray(rows) ? rows[0] : null;
  if (!profile || !profile.is_active) {
    return { ok: false, status: 403, error: 'Profil utilisateur inactif ou introuvable.' };
  }

  if (String(profile.role || '').toLowerCase() !== 'admin') {
    return { ok: false, status: 403, error: 'Accès réservé aux administrateurs.' };
  }

  return { ok: true, status: 200, callerProfile: profile };
}

function formatSchemaError(err: any, fallbackContext: string): string {
  const msg = String(err?.message || fallbackContext);
  if (err?.code === '42703' || msg.toLowerCase().includes('does not exist')) {
    return `Schéma Supabase public.profiles incomplet (${msg}). Exécutez la migration SQL ajoutant les colonnes manquantes (ex: email, auth_user_id, permissions).`;
  }
  return msg;
}

export default async function handler(req: any, res: any) {
  if (req?.method === 'OPTIONS') {
    if (typeof res?.setHeader === 'function') {
      res.setHeader('Allow', 'GET, POST, PATCH, OPTIONS');
    }
    res.statusCode = 204;
    return res.end();
  }

  try {
    const { client: adminClient, missingVars } = getServerSupabaseAdmin();
    if (!adminClient) {
      return sendJson(res, 503, {
        success: false,
        error: `Configuration serveur Vercel/Node manquante : ${missingVars.join(' et ')}. Ajoutez ces variables dans Vercel → Settings → Environment Variables (Production), puis redéployez.`,
      });
    }

    const authCheck = await verifyAdminCaller(req, adminClient);
    if (!authCheck.ok) {
      return sendJson(res, authCheck.status, { success: false, error: authCheck.error });
    }

    if (req.method === 'GET') {
      const { data, error } = await adminClient
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        return sendJson(res, 500, {
          success: false,
          error: formatSchemaError(error, 'Erreur lecture table profiles.'),
        });
      }

      const normalizedUsers = (data || []).map((u: any) => ({
        id: u.id,
        auth_user_id: u.auth_user_id ?? null,
        email: u.email ?? null,
        username: u.username,
        display_name: u.display_name,
        role: String(u.role || '').toLowerCase() === 'admin' ? 'admin' : 'operateur',
        phone: u.phone ?? null,
        is_active: u.is_active !== false,
        permissions: u.permissions ?? {},
        created_at: u.created_at,
        updated_at: u.updated_at,
      }));

      return sendJson(res, 200, { success: true, users: normalizedUsers });
    }

    if (req.method === 'POST') {
      let body: Record<string, any>;
      try {
        body = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { success: false, error: 'Corps de requête JSON invalide.' });
      }

      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const displayName = String(body.display_name || '').trim();
      const username = normalizeUsername(String(body.username || ''), email);
      const role: 'admin' | 'operateur' =
        String(body.role || 'operateur').toLowerCase() === 'admin' ? 'admin' : 'operateur';
      const phone = body.phone ? String(body.phone).trim() : null;
      const isActive = body.is_active !== false;
      const permissions = normalizePermissionsMatrix(role, body.permissions);

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return sendJson(res, 400, { success: false, error: 'Adresse email valide requise.' });
      }
      if (password.length < 6) {
        return sendJson(res, 400, {
          success: false,
          error: 'Le mot de passe doit contenir au moins 6 caractères.',
        });
      }
      if (!displayName) {
        return sendJson(res, 400, { success: false, error: 'Le nom affiché est obligatoire.' });
      }
      if (!username) {
        return sendJson(res, 400, {
          success: false,
          error: 'L’identifiant (username) est obligatoire.',
        });
      }

      // 1. Pre-check existing profiles BEFORE touching Supabase Auth (never touch existing users/admins)
      const { data: emailMatches, error: emailCheckErr } = await adminClient
        .from('profiles')
        .select('id, role, email')
        .ilike('email', email)
        .limit(1);

      if (emailCheckErr) {
        return sendJson(res, 500, {
          success: false,
          error: formatSchemaError(emailCheckErr, 'Erreur vérification email dans public.profiles.'),
        });
      }
      if (Array.isArray(emailMatches) && emailMatches.length > 0) {
        return sendJson(res, 409, {
          success: false,
          error: 'Un compte et un profil existent déjà pour cette adresse email.',
        });
      }

      const { data: usernameMatches, error: usernameCheckErr } = await adminClient
        .from('profiles')
        .select('id, username')
        .ilike('username', username)
        .limit(1);

      if (usernameCheckErr) {
        return sendJson(res, 500, {
          success: false,
          error: formatSchemaError(
            usernameCheckErr,
            'Erreur vérification username dans public.profiles.'
          ),
        });
      }
      if (Array.isArray(usernameMatches) && usernameMatches.length > 0) {
        return sendJson(res, 409, {
          success: false,
          error: `L’identifiant '@${username}' est déjà utilisé par un autre compte.`,
        });
      }

      // 2. Create Supabase Auth user (or safely recover an orphaned Auth account with ZERO profile)
      let authUserId: string | null = null;
      let createdFreshAuthUser = false;

      const { data: authCreated, error: authErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          username,
          role,
        },
      });

      if (authErr || !authCreated?.user) {
        const msg = String(authErr?.message || '');
        const alreadyRegistered =
          msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered');

        if (alreadyRegistered) {
          const orphanAuthUser = await findAuthUserByEmail(adminClient, email);
          if (orphanAuthUser?.id) {
            const { data: profileByUidRows, error: uidCheckErr } = await adminClient
              .from('profiles')
              .select('id')
              .eq('auth_user_id', orphanAuthUser.id)
              .limit(1);

            if (uidCheckErr) {
              return sendJson(res, 500, {
                success: false,
                error: formatSchemaError(uidCheckErr, 'Erreur vérification auth_user_id.'),
              });
            }

            if (Array.isArray(profileByUidRows) && profileByUidRows.length > 0) {
              return sendJson(res, 409, {
                success: false,
                error: 'Ce compte utilisateur est déjà associé à un profil actif ou existant.',
              });
            }

            const { error: repairErr } = await adminClient.auth.admin.updateUserById(
              orphanAuthUser.id,
              {
                password,
                email_confirm: true,
                ban_duration: isActive ? 'none' : '876000h',
                user_metadata: { display_name: displayName, username, role },
              }
            );
            if (repairErr) {
              return sendJson(res, 400, { success: false, error: repairErr.message });
            }
            authUserId = orphanAuthUser.id;
            createdFreshAuthUser = false;
          }
        }

        if (!authUserId) {
          return sendJson(res, 400, {
            success: false,
            error: authErr?.message || 'Erreur création compte Supabase Auth.',
          });
        }
      } else {
        authUserId = authCreated.user.id;
        createdFreshAuthUser = true;
      }

      // 3. Create (or update if a DB trigger created a skeleton row for this brand-new UUID) the linked profile
      let insertedProfile: any = null;
      let profileWriteErr: any = null;

      try {
        const { data: triggerRows } = await adminClient
          .from('profiles')
          .select('id')
          .eq('auth_user_id', authUserId)
          .limit(1);

        const triggerProfile = Array.isArray(triggerRows) ? triggerRows[0] : null;
        const profilePayload = {
          id: triggerProfile?.id || randomUUID(),
          auth_user_id: authUserId,
          email,
          username,
          display_name: displayName,
          role,
          phone,
          is_active: isActive,
          permissions,
          updated_at: new Date().toISOString(),
        };

        if (triggerProfile?.id) {
          const { data, error } = await adminClient
            .from('profiles')
            .update(profilePayload)
            .eq('id', triggerProfile.id)
            .select()
            .single();
          insertedProfile = data;
          profileWriteErr = error;
        } else {
          const { data, error } = await adminClient
            .from('profiles')
            .insert([profilePayload])
            .select()
            .single();
          insertedProfile = data;
          profileWriteErr = error;
        }
      } catch (err: any) {
        profileWriteErr = err;
      }

      if (
        profileWriteErr ||
        !insertedProfile ||
        insertedProfile.auth_user_id !== authUserId
      ) {
        if (createdFreshAuthUser && authUserId) {
          await rollbackAuthUserCreation(adminClient, authUserId);
        }
        return sendJson(res, 400, {
          success: false,
          error: profileWriteErr
            ? formatSchemaError(
                profileWriteErr,
                'Échec création du profil ERP lié : compte Auth annulé pour éviter tout orphelin.'
              )
            : 'Échec création du profil ERP lié : compte Auth annulé pour éviter tout orphelin.',
        });
      }

      try {
        await adminClient.from('audit_logs').insert([
          {
            id: `log-${randomUUID()}`,
            user_id: authCheck.callerProfile.id,
            user_name: authCheck.callerProfile.display_name,
            action: 'CREATION_UTILISATEUR',
            module: 'SETTINGS',
            record_id: insertedProfile.id,
            details: `Création compte ${email} (@${username}, ${role}, actif=${insertedProfile.is_active})`,
          },
        ]);
      } catch {
        // Never fail user creation if audit log write is unavailable
      }

      return sendJson(res, 201, { success: true, user: insertedProfile });
    }

    if (req.method === 'PATCH') {
      let body: Record<string, any>;
      try {
        body = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { success: false, error: 'Corps de requête JSON invalide.' });
      }

      const id = String(body.id || '').trim();
      if (!id) {
        return sendJson(res, 400, { success: false, error: 'ID utilisateur manquant.' });
      }

      const { data: existingRows, error: fetchErr } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', id)
        .limit(1);

      if (fetchErr) {
        return sendJson(res, 500, {
          success: false,
          error: formatSchemaError(fetchErr, 'Erreur lecture profil utilisateur.'),
        });
      }

      const existing = Array.isArray(existingRows) ? existingRows[0] : null;
      if (!existing) {
        return sendJson(res, 404, { success: false, error: 'Profil utilisateur introuvable.' });
      }

      const nextRole: 'admin' | 'operateur' =
        body.role !== undefined
          ? String(body.role).toLowerCase() === 'admin'
            ? 'admin'
            : 'operateur'
          : String(existing.role || '').toLowerCase() === 'admin'
            ? 'admin'
            : 'operateur';
      const nextActive = body.is_active !== undefined ? Boolean(body.is_active) : existing.is_active;

      if (existing.id === authCheck.callerProfile.id && (!nextActive || nextRole !== 'admin')) {
        return sendJson(res, 400, {
          success: false,
          error: 'Vous ne pouvez pas désactiver ou rétrograder votre propre compte administrateur.',
        });
      }

      const updates: Record<string, any> = {
        role: nextRole,
        is_active: nextActive,
        updated_at: new Date().toISOString(),
      };
      if (body.display_name !== undefined) updates.display_name = String(body.display_name).trim();
      if (body.phone !== undefined) updates.phone = body.phone ? String(body.phone).trim() : null;
      if (body.permissions !== undefined || nextRole === 'admin') {
        updates.permissions = normalizePermissionsMatrix(
          nextRole,
          body.permissions !== undefined ? body.permissions : existing.permissions
        );
      }

      const { data: updatedProfile, error: updErr } = await adminClient
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updErr) {
        return sendJson(res, 400, {
          success: false,
          error: formatSchemaError(updErr, 'Erreur mise à jour profil.'),
        });
      }

      if (existing.auth_user_id) {
        const authUpdates: Record<string, any> = {
          ban_duration: nextActive ? 'none' : '876000h',
        };
        if (body.password && String(body.password).length >= 6) {
          authUpdates.password = String(body.password);
        }
        const { error: authUpdErr } = await adminClient.auth.admin.updateUserById(
          existing.auth_user_id,
          authUpdates
        );
        if (authUpdErr) {
          return sendJson(res, 400, {
            success: false,
            error: `Profil mis à jour mais erreur Auth : ${authUpdErr.message}`,
          });
        }
      }

      try {
        await adminClient.from('audit_logs').insert([
          {
            id: `log-${randomUUID()}`,
            user_id: authCheck.callerProfile.id,
            user_name: authCheck.callerProfile.display_name,
            action: 'MODIFICATION_UTILISATEUR',
            module: 'SETTINGS',
            record_id: id,
            details: `Mise à jour droits/profil pour ${existing.username} (${nextRole}, actif=${nextActive})`,
          },
        ]);
      } catch {
        // ignore audit write errors
      }

      return sendJson(res, 200, { success: true, user: updatedProfile });
    }

    return sendJson(res, 405, { success: false, error: `Méthode ${req.method} non autorisée.` });
  } catch (err: any) {
    console.error('Unhandled /api/admin/users error:', err);
    return sendJson(res, 500, {
      success: false,
      error: err?.message || 'Erreur serveur interne.',
    });
  }
}

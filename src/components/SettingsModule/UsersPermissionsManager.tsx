import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  CheckCircle2,
  XCircle,
  Edit3,
  KeyRound,
  RefreshCw,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { UserProfile } from '../../types/stock';
import { getCurrentAccessToken } from '../../lib/supabase';
import {
  MODULE_PERMISSION_DESCRIPTORS,
  DEFAULT_OPERATOR_PERMISSIONS,
  ADMIN_FULL_PERMISSIONS,
  PermissionMatrix,
  ModuleKey,
  ActionKey,
} from '../../lib/permissions';

interface UsersPermissionsManagerProps {
  currentProfile: UserProfile;
}

async function readApiJson(res: Response): Promise<{ data: any; errorMessage: string | null }> {
  const rawText = await res.text();
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  if (res.ok && data?.success) {
    return { data, errorMessage: null };
  }

  if (data?.error) {
    return { data, errorMessage: `[HTTP ${res.status}] ${data.error}` };
  }

  const trimmed = rawText.trim();
  const looksLikeHtml =
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html');

  if (looksLikeHtml) {
    return {
      data: null,
      errorMessage: `[HTTP ${res.status}] L'endpoint /api/admin/users a renvoyé une page HTML au lieu de JSON (fonction serverless non exécutée ou interceptée par le routage).`,
    };
  }

  return {
    data,
    errorMessage: `[HTTP ${res.status}] ${trimmed.slice(0, 220) || res.statusText || 'Réponse serveur invalide.'}`,
  };
}

export const UsersPermissionsManager: React.FC<UsersPermissionsManagerProps> = ({
  currentProfile,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'operateur'>('operateur');
  const [newPermissions, setNewPermissions] = useState<PermissionMatrix>(() =>
    JSON.parse(JSON.stringify(DEFAULT_OPERATOR_PERMISSIONS))
  );
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit Modal
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'operateur'>('operateur');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editPassword, setEditPassword] = useState('');
  const [editPermissions, setEditPermissions] = useState<PermissionMatrix>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getCurrentAccessToken();
      if (!token) throw new Error('Session expirée. Reconnectez-vous.');
      const res = await fetch('/api/admin/users', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const { data, errorMessage } = await readApiJson(res);
      if (errorMessage) {
        throw new Error(errorMessage);
      }
      setUsers(data?.users || []);
    } catch (err: any) {
      setError(err?.message || 'Erreur réseau lors du chargement des comptes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const toggleMatrixPermission = (
    matrix: PermissionMatrix,
    setter: React.Dispatch<React.SetStateAction<PermissionMatrix>>,
    modKey: ModuleKey,
    actKey: ActionKey
  ) => {
    const currentMod = matrix[modKey] || {};
    const nextVal = !currentMod[actKey];
    const updatedMod = { ...currentMod, [actKey]: nextVal };
    if (actKey !== 'view' && nextVal) {
      updatedMod.view = true;
    }
    if (actKey === 'view' && !nextVal) {
      Object.keys(updatedMod).forEach((k) => {
        updatedMod[k as ActionKey] = false;
      });
    }
    setter({ ...matrix, [modKey]: updatedMod });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (newPassword.length < 8) {
      setCreateError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setCreating(true);
    try {
      const token = await getCurrentAccessToken();
      if (!token) throw new Error('Session expirée.');
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
          display_name: newDisplayName.trim(),
          username: (newUsername || newEmail.split('@')[0]).trim().toLowerCase(),
          phone: newPhone.trim() || undefined,
          role: newRole,
          is_active: true,
          permissions: newRole === 'admin' ? ADMIN_FULL_PERMISSIONS : newPermissions,
        }),
      });
      const { data, errorMessage } = await readApiJson(res);
      if (errorMessage) {
        throw new Error(errorMessage);
      }
      setShowCreateModal(false);
      setNewEmail('');
      setNewPassword('');
      setNewDisplayName('');
      setNewUsername('');
      setNewPhone('');
      setNewRole('operateur');
      setNewPermissions(JSON.parse(JSON.stringify(DEFAULT_OPERATOR_PERMISSIONS)));
      setSuccessMsg(
        `Compte créé et lié avec succès pour ${data.user?.display_name || newDisplayName} (${data.user?.email || newEmail}).`
      );
      setTimeout(() => setSuccessMsg(''), 5000);
      await loadUsers();
    } catch (err: any) {
      setCreateError(err?.message || 'Erreur lors de la création.');
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (u: UserProfile) => {
    setEditingUser(u);
    setEditDisplayName(u.display_name);
    setEditPhone(u.phone || '');
    setEditRole(u.role === 'admin' ? 'admin' : 'operateur');
    setEditIsActive(u.is_active !== false);
    setEditPassword('');
    setEditPermissions(
      u.permissions && Object.keys(u.permissions).length > 0
        ? JSON.parse(JSON.stringify(u.permissions))
        : JSON.parse(JSON.stringify(DEFAULT_OPERATOR_PERMISSIONS))
    );
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError('');
    if (editPassword && editPassword.length < 8) {
      setEditError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setSavingEdit(true);
    try {
      const token = await getCurrentAccessToken();
      if (!token) throw new Error('Session expirée.');
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: editingUser.id,
          display_name: editDisplayName.trim(),
          phone: editPhone.trim() || null,
          role: editRole,
          is_active: editIsActive,
          permissions: editRole === 'admin' ? ADMIN_FULL_PERMISSIONS : editPermissions,
          ...(editPassword ? { password: editPassword } : {}),
        }),
      });
      const { errorMessage } = await readApiJson(res);
      if (errorMessage) {
        throw new Error(errorMessage);
      }
      setEditingUser(null);
      setSuccessMsg(`Droits mis à jour pour ${editDisplayName}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadUsers();
    } catch (err: any) {
      setEditError(err?.message || 'Erreur lors de la modification.');
    } finally {
      setSavingEdit(false);
    }
  };

  const renderPermissionMatrixEditor = (
    matrix: PermissionMatrix,
    setter: React.Dispatch<React.SetStateAction<PermissionMatrix>>
  ) => (
    <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100 bg-stone-50/40">
      {MODULE_PERMISSION_DESCRIPTORS.map((mod) => {
        const modPerms = matrix[mod.key] || {};
        return (
          <div key={mod.key} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-stone-900 text-xs block">{mod.labelFr}</span>
              <span className="text-[10px] text-stone-500 font-arabic">{mod.labelAr}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {mod.actions.map((act) => {
                const checked = Boolean(modPerms[act.key]);
                return (
                  <label
                    key={act.key}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer select-none transition ${
                      checked
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMatrixPermission(matrix, setter, mod.key, act.key)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{act.labelFr}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-stone-900">
              Gestion des Comptes Utilisateurs &amp; Permissions RBAC
            </h3>
            <p className="text-xs text-stone-500">
              Créez des comptes opérateurs/administrateurs (Supabase Auth) et configurez leurs droits par module.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="p-2 border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-100 cursor-pointer"
            title="Actualiser la liste"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateError('');
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-amber-400" />
            <span>Nouvel Utilisateur</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Erreur d&apos;administration :</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Liste des utilisateurs */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            <span>Chargement des comptes ERP...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-400 italic">
            Aucun compte utilisateur trouvé.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                <tr>
                  <th className="p-3.5">Nom &amp; Identifiant</th>
                  <th className="p-3.5">Email de connexion</th>
                  <th className="p-3.5">Rôle</th>
                  <th className="p-3.5">Statut</th>
                  <th className="p-3.5">Modules Autorisés</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {users.map((u) => {
                  const isSelf = u.id === currentProfile.id;
                  const enabledModulesCount =
                    u.role === 'admin'
                      ? MODULE_PERMISSION_DESCRIPTORS.length
                      : MODULE_PERMISSION_DESCRIPTORS.filter((m) => u.permissions?.[m.key]?.view).length;

                  return (
                    <tr key={u.id} className="hover:bg-stone-50">
                      <td className="p-3.5">
                        <div className="font-bold text-stone-900 flex items-center gap-1.5">
                          <span>{u.display_name}</span>
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded font-bold">
                              Vous
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-stone-500">@{u.username}</span>
                      </td>
                      <td className="p-3.5 font-mono text-stone-700">{u.email || '—'}</td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          {u.role === 'admin' ? 'Administrateur' : 'Opérateur'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3" />
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                            <XCircle className="w-3 h-3" />
                            Désactivé
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-stone-600 font-medium">
                        {u.role === 'admin'
                          ? 'Accès intégral (10/10 modules)'
                          : `${enabledModulesCount} / ${MODULE_PERMISSION_DESCRIPTORS.length} modules`}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg font-bold transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Droits &amp; Profil</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Création Utilisateur */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-700" />
                <h3 className="text-base font-bold text-stone-900">Créer un Compte Utilisateur</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 bg-rose-50 border-l-4 border-rose-500 rounded text-xs text-rose-800 font-medium">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Nom complet affiché *</label>
                  <input
                    type="text"
                    required
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="Ex: Achref Ben Salah"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Identifiant court (Username) *</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Ex: achref"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Adresse Email (Connexion) *</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="employe@huileriejemai.tn"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Mot de passe initial * (min 8 car.)</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+216 ..."
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Rôle Global *</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'admin' | 'operateur')}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white font-bold"
                  >
                    <option value="operateur">Opérateur (Permissions granulaires)</option>
                    <option value="admin">Administrateur (Accès complet)</option>
                  </select>
                </div>
              </div>

              {newRole === 'operateur' && (
                <div>
                  <label className="block font-bold text-stone-800 mb-2">
                    Matrice des Permissions par Module &amp; Action
                  </label>
                  {renderPermissionMatrixEditor(newPermissions, setNewPermissions)}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-stone-300 rounded-lg font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Créer le Compte</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Modification Utilisateur & Permissions */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-700" />
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    Modifier {editingUser.display_name}
                  </h3>
                  <span className="text-[11px] font-mono text-stone-500">{editingUser.email}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-rose-50 border-l-4 border-rose-500 rounded text-xs text-rose-800 font-medium">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Nom affiché *</label>
                  <input
                    type="text"
                    required
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Rôle</label>
                  <select
                    value={editRole}
                    disabled={editingUser.id === currentProfile.id}
                    onChange={(e) => setEditRole(e.target.value as 'admin' | 'operateur')}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white font-bold disabled:bg-stone-100"
                  >
                    <option value="operateur">Opérateur</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Réinitialiser mot de passe (optionnel)
                  </label>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Laisser vide pour ne pas changer"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 font-bold text-stone-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsActive}
                  disabled={editingUser.id === currentProfile.id}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span>Compte actif (autorisé à se connecter)</span>
              </label>

              {editRole === 'operateur' && (
                <div>
                  <label className="block font-bold text-stone-800 mb-2">
                    Permissions Granulaires par Module
                  </label>
                  {renderPermissionMatrixEditor(editPermissions, setEditPermissions)}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-stone-300 rounded-lg font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Enregistrer les Droits</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

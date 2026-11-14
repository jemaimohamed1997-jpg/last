/**
 * RBAC & Granular Per-Module / Per-Action Permissions for Huilerie Jemai ERP
 */

export type ModuleKey =
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

export type ActionKey =
  | 'view'
  | 'create'
  | 'edit'
  | 'confirm'
  | 'cancel'
  | 'pay'
  | 'export'
  | 'admin';

export type ModulePermissions = Partial<Record<ActionKey, boolean>>;
export type PermissionMatrix = Partial<Record<ModuleKey, ModulePermissions>>;

export interface ModulePermissionDescriptor {
  key: ModuleKey;
  labelFr: string;
  labelAr: string;
  actions: { key: ActionKey; labelFr: string }[];
}

export const MODULE_PERMISSION_DESCRIPTORS: ModulePermissionDescriptor[] = [
  {
    key: 'RECEPTIONS',
    labelFr: 'Réception Olives',
    labelAr: 'استلام الزيتون',
    actions: [
      { key: 'view', labelFr: 'Consulter' },
      { key: 'create', labelFr: 'Créer' },
      { key: 'edit', labelFr: 'Modifier' },
      { key: 'pay', labelFr: 'Encaisser' },
      { key: 'export', labelFr: 'Exporter' },
    ],
  },
  {
    key: 'PRODUCTION',
    labelFr: 'Trituration',
    labelAr: 'العصر وخط الإنتاج',
    actions: [
      { key: 'view', labelFr: 'Consulter' },
      { key: 'create', labelFr: 'Créer lot' },
      { key: 'edit', labelFr: 'Modifier' },
      { key: 'confirm', labelFr: 'Confirmer' },
      { key: 'export', labelFr: 'Exporter' },
    ],
  },
  {
    key: 'GRIGNONS',
    labelFr: 'Vente Grignons',
    labelAr: 'بيع الفيتورة',
    actions: [
      { key: 'view', labelFr: 'Consulter' },
      { key: 'create', labelFr: 'Créer vente' },
      { key: 'edit', labelFr: 'Modifier' },
      { key: 'pay', labelFr: 'Régler' },
      { key: 'export', labelFr: 'Exporter' },
    ],
  },
  {
    key: 'PURCHASES',
    labelFr: 'Achats et Fournisseurs',
    labelAr: 'المشتريات والمزودين',
    actions: [
      { key: 'view', labelFr: 'Consulter' },
      { key: 'create', labelFr: 'Créer achat' },
      { key: 'edit', labelFr: 'Modifier' },
      { key: 'pay', labelFr: 'Régler' },
      { key: 'export', labelFr: 'Exporter' },
    ],
  },
  {
    key: 'CUVES',
    labelFr: 'Gestion de Stock',
    labelAr: 'إدارة الخزانات والمخزون',
    actions: [
      { key: 'view', labelFr: 'Consulter' },
      { key: 'create', labelFr: 'Entrée / Sortie / Transfert' },
      { key: 'edit', labelFr: 'Modifier Cuve / BON-REC' },
      { key: 'cancel', labelFr: 'Annuler mouvement' },
      { key: 'export', labelFr: 'Exporter' },
    ],
  },
  {
    key: 'FINANCES',
    labelFr: 'Caisse & Finance',
    labelAr: 'الصندوق والمالية',
    actions: [
      { key: 'view', labelFr: 'Consulter' },
      { key: 'create', labelFr: 'Créer dépense / encaissement' },
      { key: 'edit', labelFr: 'Modifier' },
      { key: 'export', labelFr: 'Exporter' },
    ],
  },
  {
    key: 'CUSTOMER_HISTORY',
    labelFr: 'Historique Clients',
    labelAr: 'سجل الحرفاء والإنتاج',
    actions: [
      { key: 'view', labelFr: 'Consulter' },
      { key: 'edit', labelFr: 'Transférer en Cuve' },
      { key: 'export', labelFr: 'Exporter' },
    ],
  },
  {
    key: 'CLIENTS',
    labelFr: 'Répertoires Clients',
    labelAr: 'دليل الحرفاء والفلاحين',
    actions: [
      { key: 'view', labelFr: 'Consulter' },
      { key: 'create', labelFr: 'Créer client' },
      { key: 'edit', labelFr: 'Modifier client' },
      { key: 'export', labelFr: 'Exporter' },
    ],
  },
  {
    key: 'PERSONNEL',
    labelFr: 'Gestion du Personnel',
    labelAr: 'إدارة الموظفين والأجور',
    actions: [
      { key: 'view', labelFr: 'Consulter' },
      { key: 'create', labelFr: 'Employés & Avances' },
      { key: 'edit', labelFr: 'Modifier fiche' },
      { key: 'pay', labelFr: 'Régler salaire' },
      { key: 'export', labelFr: 'Exporter' },
    ],
  },
  {
    key: 'SETTINGS',
    labelFr: 'Paramètres',
    labelAr: 'الإعدادات',
    actions: [
      { key: 'view', labelFr: 'Consulter' },
      { key: 'edit', labelFr: 'Modifier paramètres' },
      { key: 'admin', labelFr: 'Utilisateurs & Tests' },
    ],
  },
];

export const ADMIN_FULL_PERMISSIONS: PermissionMatrix = {
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

export const DEFAULT_OPERATOR_PERMISSIONS: PermissionMatrix = {
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

export interface AuthProfileLike {
  role?: 'admin' | 'operateur' | string;
  is_active?: boolean;
  permissions?: PermissionMatrix | null;
}

export function isAdminProfile(profile?: AuthProfileLike | null): boolean {
  if (!profile || profile.is_active === false) return false;
  return String(profile.role || '').toLowerCase() === 'admin';
}

export function canAccessModule(profile: AuthProfileLike | null | undefined, module: ModuleKey): boolean {
  if (!profile || profile.is_active === false) return false;
  if (isAdminProfile(profile)) return true;
  const modPerms = profile.permissions?.[module];
  if (!modPerms) return false;
  return Boolean(modPerms.view);
}

export function canPerformAction(
  profile: AuthProfileLike | null | undefined,
  module: ModuleKey,
  action: ActionKey
): boolean {
  if (!profile || profile.is_active === false) return false;
  if (isAdminProfile(profile)) return true;
  const modPerms = profile.permissions?.[module];
  if (!modPerms) return false;
  return Boolean(modPerms[action]);
}

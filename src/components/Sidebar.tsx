import React from 'react';
import {
  Database,
  Scale,
  Cog,
  History,
  Truck,
  ShoppingCart,
  Wallet,
  Users,
  UserCog,
  Settings as SettingsIcon,
  ShieldCheck,
} from 'lucide-react';
import { Language } from '../lib/i18n';
import { UserProfile } from '../types/stock';
import { canAccessModule, ModuleKey } from '../lib/permissions';

export type ActiveModule = ModuleKey;

interface SidebarProps {
  activeModule: ActiveModule;
  currentProfile: UserProfile;
  lang: Language;
  queueCount: number;
  alertTanksCount: number;
  onSelectModule: (m: ActiveModule) => void;
}

export const getOrderedSidebarItems = (
  lang: Language,
  queueCount: number,
  alertTanksCount: number
) => [
  {
    id: 'RECEPTIONS' as ActiveModule,
    num: 1,
    label: lang === 'ar' ? 'استلام الزيتون' : 'Réception Olives',
    icon: Scale,
  },
  {
    id: 'PRODUCTION' as ActiveModule,
    num: 2,
    label: lang === 'ar' ? 'العصر والطحن' : 'Trituration',
    icon: Cog,
    badge: queueCount > 0 ? `${queueCount}` : undefined,
    badgeColor: 'bg-amber-500 text-stone-950 font-bold',
  },
  {
    id: 'GRIGNONS' as ActiveModule,
    num: 3,
    label: lang === 'ar' ? 'بيع الفيتورة' : 'Vente Grignons',
    icon: Truck,
  },
  {
    id: 'PURCHASES' as ActiveModule,
    num: 4,
    label: lang === 'ar' ? 'المشتريات والمزودين' : 'Achats et Fournisseurs',
    icon: ShoppingCart,
  },
  {
    id: 'CUVES' as ActiveModule,
    num: 5,
    label: lang === 'ar' ? 'إدارة المخزون' : 'Gestion de Stock',
    icon: Database,
    badge: alertTanksCount > 0 ? `${alertTanksCount} alerte(s)` : undefined,
    badgeColor: 'bg-rose-500 text-white',
  },
  {
    id: 'FINANCES' as ActiveModule,
    num: 6,
    label: lang === 'ar' ? 'الصندوق والمالية' : 'Caisse & Finance',
    icon: Wallet,
  },
  {
    id: 'CUSTOMER_HISTORY' as ActiveModule,
    num: 7,
    label: lang === 'ar' ? 'سجل الحرفاء' : 'Historique Clients',
    icon: History,
  },
  {
    id: 'CLIENTS' as ActiveModule,
    num: 8,
    label: lang === 'ar' ? 'دليل الحرفاء' : 'Répertoires Clients',
    icon: Users,
  },
  {
    id: 'PERSONNEL' as ActiveModule,
    num: 9,
    label: lang === 'ar' ? 'إدارة الموظفين والأجور' : 'Gestion du Personnel',
    icon: UserCog,
  },
  {
    id: 'SETTINGS' as ActiveModule,
    num: 10,
    label: lang === 'ar' ? 'الإعدادات' : 'Paramètres',
    icon: SettingsIcon,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  currentProfile,
  lang,
  queueCount,
  alertTanksCount,
  onSelectModule,
}) => {
  const navItems = getOrderedSidebarItems(lang, queueCount, alertTanksCount).filter((item) =>
    canAccessModule(currentProfile, item.id)
  );

  return (
    <aside className="no-print hidden md:flex w-64 bg-stone-900 border-r border-stone-800 flex-col shrink-0 min-h-[calc(100vh-61px)]">
      <div className="p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectModule(item.id)}
              className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-md'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-stone-950' : 'text-stone-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-auto p-4 border-t border-stone-800 text-[11px] text-stone-400">
        <div className="flex items-center gap-1.5 text-stone-300 font-semibold mb-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>RBAC &amp; PostgreSQL Actifs</span>
        </div>
        <p className="text-[10px] text-stone-500 leading-normal">
          Traçabilité stricte par cuve, client et bon officiel · Huilerie Jemai
        </p>
      </div>
    </aside>
  );
};

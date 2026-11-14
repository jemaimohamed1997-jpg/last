import React from 'react';
import { Globe, UserCheck, Shield, Droplet, LogOut } from 'lucide-react';
import { AppSettings, UserProfile } from '../types/stock';
import { Language } from '../lib/i18n';

interface NavbarProps {
  settings: AppSettings;
  currentProfile: UserProfile;
  lang: Language;
  isOnline: boolean;
  onToggleLanguage: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  currentProfile,
  lang,
  isOnline,
  onToggleLanguage,
  onLogout,
}) => {
  return (
    <header className="no-print bg-stone-900 text-white border-b border-stone-800 sticky top-0 z-40 px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black shadow-xs overflow-hidden shrink-0">
          {settings.logo_url ? (
            <img
              src={settings.logo_url}
              alt={settings.company_name}
              className="w-full h-full object-contain p-0.5 bg-white rounded-lg"
            />
          ) : (
            <Droplet className="w-5 h-5 fill-current" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-base tracking-tight text-white">
              {settings.company_name}
            </h1>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-bold">
              ERP
            </span>
          </div>
          <p className="text-xs font-arabic text-amber-300 font-bold" dir="rtl">
            {settings.arabic_subtitle}
          </p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        <div
          title={isOnline ? 'Base de données Supabase connectée en direct' : 'Connexion Supabase interrompue'}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-stone-800/80 rounded-lg border border-stone-700/80 text-xs"
        >
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
          <span className="text-stone-300 text-[11px] font-medium font-mono">
            {isOnline ? 'Supabase Cloud' : 'Déconnecté'}
          </span>
        </div>

        <button
          onClick={onToggleLanguage}
          className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg text-xs font-bold text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Changer de langue / تغيير اللغة"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{lang === 'fr' ? 'العربية' : 'Français'}</span>
        </button>

        {/* Authenticated User Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-stone-800 border border-stone-700 rounded-lg text-xs">
          {currentProfile.role === 'admin' ? (
            <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          ) : (
            <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <div className="text-left hidden sm:block">
            <span className="font-bold text-stone-200 block text-[11px] leading-tight">
              {currentProfile.display_name}
            </span>
            <span className="text-[10px] text-stone-400 capitalize">
              {currentProfile.role === 'admin' ? 'Administrateur' : 'Opérateur'}
            </span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-stone-800 hover:bg-rose-950/80 text-stone-300 hover:text-rose-300 border border-stone-700 rounded-lg text-xs font-bold transition cursor-pointer"
          title="Se déconnecter"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{lang === 'ar' ? 'خروج' : 'Déconnexion'}</span>
        </button>
      </div>
    </header>
  );
};

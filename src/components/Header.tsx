import React, { useState, useEffect } from 'react';
import {
  Droplet,
  PlusCircle,
  MinusCircle,
  ArrowLeftRight,
  Save,
  UserCircle2,
  Clock,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { UserSession, AppSettings } from '../types';

interface HeaderProps {
  currentUser: UserSession;
  onLogout?: () => void;
  onOpenEntree: () => void;
  onOpenSortie: () => void;
  onOpenTransfert: () => void;
  onQuickBackup: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  settings: AppSettings;
  canCreateStock?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onOpenEntree,
  onOpenSortie,
  onOpenTransfert,
  onQuickBackup,
  onRefresh,
  isRefreshing = false,
  settings,
  canCreateStock = true,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }) +
          ' ' +
          now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-stone-900 text-stone-100 border-b border-stone-800 shadow-md rounded-2xl mb-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand Block */}
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-lime-600 via-emerald-700 to-amber-600 p-0.5 shadow-lg flex items-center justify-center overflow-hidden">
            <div className="w-full h-full bg-stone-950 rounded-[10px] flex items-center justify-center text-amber-400 overflow-hidden">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt={settings.nomEntreprise} className="w-full h-full object-contain bg-white p-0.5" />
              ) : (
                <Droplet className="w-6 h-6 fill-amber-400/80 text-amber-300" />
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
                {settings.nomEntreprise}
              </h1>
              <span className="text-amber-400 text-sm font-bold font-serif px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60">
                {settings.sousTitreArabe}
              </span>
            </div>
            <p className="text-xs text-stone-400 font-medium">
              Gestion des Cuves, Stocks Clients &amp; Bons Officiels
            </p>
          </div>
        </div>

        {/* Center: Clock & Status */}
        <div className="hidden lg:flex items-center space-x-4 text-xs text-stone-300">
          <div className="flex items-center space-x-2 bg-stone-800/80 px-3 py-1.5 rounded-lg border border-stone-700">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="font-mono">{currentTime}</span>
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center space-x-2">
          <div className="hidden md:flex items-center space-x-2">
            {canCreateStock && (
              <>
                <button
                  onClick={onOpenEntree}
                  className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Entrée d&apos;Huile</span>
                </button>

                <button
                  onClick={onOpenSortie}
                  className="inline-flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <MinusCircle className="w-4 h-4" />
                  <span>Sortie d&apos;Huile</span>
                </button>

                <button
                  onClick={onOpenTransfert}
                  className="inline-flex items-center space-x-1.5 bg-sky-700 hover:bg-sky-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Transfert</span>
                </button>
              </>
            )}

            <button
              onClick={onQuickBackup}
              className="inline-flex items-center space-x-1 bg-stone-800 hover:bg-stone-700 text-stone-200 px-2.5 py-2 rounded-lg text-xs font-medium border border-stone-700 transition active:scale-95 cursor-pointer"
              title="Snapshot mémoire"
            >
              <Save className="w-3.5 h-3.5 text-stone-300" />
            </button>

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-emerald-800 to-stone-800 hover:from-emerald-700 hover:to-stone-700 text-emerald-300 hover:text-white border border-emerald-600/50 px-3 py-2 rounded-lg text-xs font-extrabold shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-300' : 'text-emerald-400'}`} />
                <span>{isRefreshing ? 'SYNCHRO...' : 'ACTUALISER'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1.5 bg-stone-800/90 text-stone-200 border border-stone-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold">
            <UserCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline font-bold truncate max-w-[120px]">{currentUser.nomAffiche}</span>
            <span
              className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                currentUser.role === 'admin'
                  ? 'bg-purple-900/80 text-purple-200 border border-purple-700'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
              }`}
            >
              {currentUser.role}
            </span>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-800 hover:bg-red-950/80 text-stone-300 hover:text-red-300 border border-stone-700 rounded-lg text-xs font-bold transition cursor-pointer"
              title="Se déconnecter"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

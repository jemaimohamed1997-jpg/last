import React, { useState } from 'react';
import { Droplet, Lock, Mail, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { signInWithEmailPassword, isSupabaseConfigured } from '../../lib/supabase';
import { UserProfile } from '../../types/stock';

interface AppLoginScreenProps {
  companyName?: string;
  arabicSubtitle?: string;
  logoUrl?: string | null;
  onAuthenticated: (profile: UserProfile) => void;
}

export const AppLoginScreen: React.FC<AppLoginScreenProps> = ({
  companyName = 'HUILERIE JEMAI',
  arabicSubtitle = 'معصرة جماعي لإنتاج وتخزين زيت الزيتون',
  logoUrl,
  onAuthenticated,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Veuillez saisir votre adresse email et votre mot de passe.');
      return;
    }

    setLoading(true);
    try {
      const profile = await signInWithEmailPassword(email, password);
      onAuthenticated(profile);
    } catch (err: any) {
      setError(err?.message || 'Échec de connexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.14),_transparent_55%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.12),_transparent_55%)] pointer-events-none" />

      <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden relative z-10">
        <div className="p-7 bg-gradient-to-br from-stone-900 via-stone-900 to-stone-800 border-b border-stone-800 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center overflow-hidden mb-4 shadow-inner">
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="w-full h-full object-contain p-1.5" />
            ) : (
              <Droplet className="w-8 h-8 text-amber-400 fill-amber-400/80" />
            )}
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">{companyName}</h1>
          <p className="text-sm font-arabic text-amber-300 font-bold mt-1" dir="rtl">
            {arabicSubtitle}
          </p>
          <p className="text-xs text-stone-400 mt-2">
            Accès sécurisé · Système ERP &amp; Gestion Cuverie
          </p>
        </div>

        <div className="p-7 space-y-5">
          {!isSupabaseConfigured && (
            <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-700/70 text-amber-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Configuration Supabase requise</span>
              </div>
              <p className="leading-relaxed text-amber-200/90">
                Définissez <code className="font-mono bg-stone-950 px-1 rounded">VITE_SUPABASE_URL</code> et{' '}
                <code className="font-mono bg-stone-950 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> dans les variables
                d’environnement avant de vous connecter.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-700/70 text-rose-200 text-xs font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1.5">
                Adresse Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@huilerie-jemai.tn"
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-950 border border-stone-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-sm text-white placeholder-stone-500 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-950 border border-stone-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-sm text-white placeholder-stone-500 outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isSupabaseConfigured}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-extrabold text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Se Connecter à l’ERP</span>
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-center text-stone-500 leading-relaxed pt-1">
            Authentification gérée par Supabase Auth · Les comptes opérateurs sont créés et configurés
            exclusivement par l’administrateur dans Paramètres.
          </p>
        </div>
      </div>
    </div>
  );
};

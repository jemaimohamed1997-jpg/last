import React, { useState, useRef } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  Database,
  Shield,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  Users,
  FlaskConical,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { AppSettings, UserProfile } from '../../types/stock';
import { AuditLog } from '../../types/production';
import { Language } from '../../lib/i18n';
import {
  OIL_KG_TO_LITRES_FACTOR,
  saveLiveAppSettings,
  uploadCompanyLogo,
} from '../../lib/supabase';
import { canPerformAction } from '../../lib/permissions';
import { UsersPermissionsManager } from './UsersPermissionsManager';
import { AutomatedTestSuite } from '../AutomatedTestSuite';

interface SettingsViewProps {
  settings: AppSettings;
  currentProfile: UserProfile;
  isOnline: boolean;
  auditLogs: AuditLog[];
  lang: Language;
  onSaveSettings: (updated: AppSettings) => void;
  onSyncSupabase: () => void;
}

type SettingsTab = 'COMPANY' | 'USERS' | 'TESTS';

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  currentProfile,
  isOnline,
  auditLogs,
  lang,
  onSaveSettings,
  onSyncSupabase,
}) => {
  const canEditSettings = canPerformAction(currentProfile, 'SETTINGS', 'edit');
  const canAdminSettings = canPerformAction(currentProfile, 'SETTINGS', 'admin');

  const [activeTab, setActiveTab] = useState<SettingsTab>('COMPANY');

  const [companyName, setCompanyName] = useState(settings.company_name);
  const [arabicSubtitle, setArabicSubtitle] = useState(settings.arabic_subtitle);
  const [phone, setPhone] = useState(settings.phone);
  const [address, setAddress] = useState(settings.address);
  const [threshold, setThreshold] = useState(settings.threshold || 85);
  const [defaultFeeRate, setDefaultFeeRate] = useState(
    settings.default_milling_fee_per_kg || 0.2
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(settings.logo_url || null);

  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    setUploadingLogo(true);
    try {
      const publicUrl = await uploadCompanyLogo(file);
      setLogoUrl(publicUrl);
      onSaveSettings({ ...settings, logo_url: publicUrl });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || "Erreur lors de l'upload du logo.");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSettings) return;
    setErrorMsg('');
    setSaving(true);
    try {
      const saved = await saveLiveAppSettings({
        company_name: companyName.trim(),
        arabic_subtitle: arabicSubtitle.trim(),
        phone: phone.trim(),
        address: address.trim(),
        threshold: Number(threshold),
        default_milling_fee_per_kg: Number(defaultFeeRate),
        logo_url: logoUrl,
        settings_json: {
          ...(settings.settings_json || {}),
          threshold: Number(threshold),
          alertSeuilRemplissage: Number(threshold),
          default_milling_fee_per_kg: Number(defaultFeeRate),
        },
      });
      onSaveSettings(saved);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la sauvegarde des paramètres.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Navigation Onglets Paramètres */}
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('COMPANY')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'COMPANY'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-white border border-stone-200 text-stone-600 hover:text-stone-900'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>{lang === 'ar' ? 'المعصرة والشعار' : 'Entreprise, Logo & Audit'}</span>
        </button>

        {canAdminSettings && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('USERS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'USERS'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-600 hover:text-stone-900'
              }`}
            >
              <Users className="w-4 h-4 text-amber-500" />
              <span>Utilisateurs &amp; Permissions</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('TESTS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'TESTS'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-600 hover:text-stone-900'
              }`}
            >
              <FlaskConical className="w-4 h-4 text-emerald-500" />
              <span>Banc d&apos;Essai (16 Tests)</span>
            </button>
          </>
        )}
      </div>

      {activeTab === 'COMPANY' && (
        <div className="space-y-6">
          {/* Statut Cloud Supabase (sans URL codée en dur) */}
          <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-amber-600" />
              <div>
                <h3 className="font-bold text-sm text-stone-900">Base de Données Cloud PostgreSQL</h3>
                <span className="text-xs text-stone-500">
                  Source unique de vérité Supabase · Aucun stockage local persistant
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${
                  isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'
                  }`}
                />
                {isOnline ? 'Connecté en direct' : 'Hors ligne'}
              </span>

              <button
                type="button"
                onClick={onSyncSupabase}
                className="p-2 hover:bg-stone-100 text-stone-600 hover:text-stone-900 rounded-lg border border-stone-200 cursor-pointer"
                title="Forcer la resynchronisation"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Logo Officiel de l'Huilerie */}
          <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <ImageIcon className="w-5 h-5 text-amber-700" />
                <div>
                  <h3 className="font-bold text-sm text-stone-900">Logo Officiel de l&apos;Entreprise</h3>
                  <p className="text-xs text-stone-500">
                    Affiché dans la barre supérieure et sur tous les bons imprimables (A4 &amp; Cuverie).
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 flex items-center justify-center overflow-hidden shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo Huilerie" className="w-full h-full object-contain p-1.5" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-stone-300" />
                )}
              </div>

              <div className="space-y-2 text-xs">
                <p className="text-stone-600">
                  Formats acceptés : <strong>PNG, JPG, WEBP, SVG</strong> (max 3 Mo). Stocké sur Supabase Storage (
                  <code className="font-mono">huilerie-assets</code>).
                </p>
                {canEditSettings && (
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="company-logo-upload"
                    />
                    <label
                      htmlFor="company-logo-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl cursor-pointer shadow-xs transition"
                    >
                      {uploadingLogo ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <span>{uploadingLogo ? 'Téléversement...' : 'Choisir & Téléverser un Logo'}</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Formulaire Paramètres Entreprise */}
          <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <SettingsIcon className="w-5 h-5 text-stone-700" />
                <h3 className="font-bold text-sm text-stone-900">
                  Identité de l&apos;Établissement &amp; Règles Métier
                </h3>
              </div>
              {savedSuccess && (
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Enregistré dans Supabase !
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Nom Officiel de la Huilerie *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!canEditSettings}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-lg font-bold text-stone-900 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Sous-titre en Arabe *</label>
                  <input
                    type="text"
                    dir="rtl"
                    required
                    disabled={!canEditSettings}
                    value={arabicSubtitle}
                    onChange={(e) => setArabicSubtitle(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-lg font-arabic font-bold text-amber-900 disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Téléphone de Contact</label>
                  <input
                    type="text"
                    disabled={!canEditSettings}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-lg font-mono disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Adresse &amp; Localité</label>
                  <input
                    type="text"
                    disabled={!canEditSettings}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-lg disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                <h4 className="font-bold text-stone-800 uppercase tracking-wider text-[11px]">
                  Paramètres Techniques &amp; Tarifs
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold text-stone-600 mb-1">
                      Seuil d&apos;Alerte Cuve (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="50"
                        max="98"
                        disabled={!canEditSettings}
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        className="w-full p-2 pr-7 bg-white border border-stone-300 rounded font-mono font-bold disabled:opacity-60"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold">
                        %
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-600 mb-1">
                      Conversion Fixe Trituration
                    </label>
                    <div className="w-full p-2 bg-amber-50 border border-amber-200 rounded font-mono font-bold text-amber-900">
                      1 KG = {OIL_KG_TO_LITRES_FACTOR} L (Fixe)
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-600 mb-1">
                      Tarif Trituration Défaut / KG (TND)
                    </label>
                    <input
                      type="number"
                      step="0.005"
                      min="0.01"
                      disabled={!canEditSettings}
                      value={defaultFeeRate}
                      onChange={(e) => setDefaultFeeRate(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-stone-300 rounded font-mono font-bold disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {canEditSettings && (
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-2 shadow-2xs cursor-pointer"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>Enregistrer les Paramètres</span>
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Journal d'Audit */}
          <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-700" />
              <h3 className="font-bold text-sm text-stone-900">Journal d&apos;Audit &amp; Traçabilité</h3>
            </div>

            <div className="border border-stone-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 text-stone-600 border-b border-stone-200 sticky top-0">
                  <tr>
                    <th className="p-2.5">Date &amp; Heure</th>
                    <th className="p-2.5">Utilisateur</th>
                    <th className="p-2.5">Module</th>
                    <th className="p-2.5">Action &amp; Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-stone-50">
                        <td className="p-2.5 font-mono text-stone-500 text-[11px]">
                          {new Date(log.timestamp).toLocaleString('fr-TN')}
                        </td>
                        <td className="p-2.5 font-semibold text-stone-800">{log.user}</td>
                        <td className="p-2.5 text-stone-600">{log.module}</td>
                        <td className="p-2.5 text-stone-700">
                          <strong>{log.action}</strong>: {log.details}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-stone-400 italic">
                        Aucune action d&apos;audit consignée pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'USERS' && canAdminSettings && (
        <UsersPermissionsManager currentProfile={currentProfile} />
      )}

      {activeTab === 'TESTS' && canAdminSettings && <AutomatedTestSuite />}
    </div>
  );
};

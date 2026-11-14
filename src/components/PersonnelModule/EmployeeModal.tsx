import React, { useState } from 'react';
import { X, Users, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Employee } from '../../types/production';

export interface EmployeeFormPayload {
  full_name: string;
  phone?: string | null;
  role_title: string;
  base_salary_tnd: number;
  hire_date: string;
  is_active: boolean;
  notes?: string | null;
}

interface EmployeeModalProps {
  employee?: Employee | null;
  onClose: () => void;
  onSubmit: (payload: EmployeeFormPayload) => Promise<void>;
}

export const EmployeeModal: React.FC<EmployeeModalProps> = ({
  employee,
  onClose,
  onSubmit,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [fullName, setFullName] = useState(employee?.full_name || '');
  const [phone, setPhone] = useState(employee?.phone || '');
  const [roleTitle, setRoleTitle] = useState(employee?.role_title || 'Opérateur Presse');
  const [baseSalary, setBaseSalary] = useState<string>(
    employee ? String(employee.base_salary_tnd) : '1200'
  );
  const [hireDate, setHireDate] = useState(employee?.hire_date?.slice(0, 10) || todayStr);
  const [isActive, setIsActive] = useState<boolean>(employee ? employee.is_active : true);
  const [notes, setNotes] = useState(employee?.notes || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsedSalary = Number(baseSalary);
    if (!fullName.trim()) {
      setErrorMsg("Le nom complet de l'employé est obligatoire.");
      return;
    }
    if (!roleTitle.trim()) {
      setErrorMsg('Le poste / fonction est obligatoire.');
      return;
    }
    if (Number.isNaN(parsedSalary) || parsedSalary <= 0) {
      setErrorMsg('Le salaire de base mensuel doit être strictement supérieur à zéro.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        role_title: roleTitle.trim(),
        base_salary_tnd: Math.round(parsedSalary * 1000) / 1000,
        hire_date: hireDate || todayStr,
        is_active: isActive,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Erreur lors de l'enregistrement de l'employé.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200">
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-extrabold text-sm">
                {employee ? `Modifier Employé (${employee.code})` : 'Nouvel Employé'}
              </h3>
              <span className="text-[11px] text-stone-400">
                Fiche salarié &amp; base de paie mensuelle
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-stone-700 mb-1">Nom Complet *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: Sami Ben Amor"
              className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 mb-1">Poste / Fonction *</label>
              <input
                type="text"
                required
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="Ex: Opérateur Presse"
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium"
              />
            </div>
            <div>
              <label className="block font-bold text-stone-700 mb-1">Téléphone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+216 ..."
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                Salaire de Base Mensuel (TND) *
              </label>
              <input
                type="number"
                step="0.001"
                min="1"
                required
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
                className="w-full p-2.5 bg-amber-50 border border-amber-300 rounded-xl font-mono font-black text-amber-950"
              />
            </div>
            <div>
              <label className="block font-bold text-stone-700 mb-1">Date d&apos;Embauche *</label>
              <input
                type="date"
                required
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono"
              />
            </div>
          </div>

          {employee && (
            <label className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200 cursor-pointer">
              <span className="font-bold text-stone-800">Employé actif dans la paie</span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded"
              />
            </label>
          )}

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observations RH..."
              className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 rounded-xl font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              <span>{employee ? 'Enregistrer' : "Créer l'Employé"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

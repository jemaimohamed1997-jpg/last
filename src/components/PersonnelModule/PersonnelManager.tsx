import React, { useState } from 'react';
import {
  Users,
  Plus,
  Banknote,
  Wallet,
  Printer,
  FileSpreadsheet,
  Edit3,
  CheckCircle2,
  Clock,
  Calendar,
} from 'lucide-react';
import { Employee, SalaryAdvance, SalaryPayment } from '../../types/production';
import { Language } from '../../lib/i18n';
import { EmployeeModal, EmployeeFormPayload } from './EmployeeModal';
import { AdvanceModal } from './AdvanceModal';
import { PayrollSettlementModal } from './PayrollSettlementModal';

interface PersonnelManagerProps {
  employees: Employee[];
  salaryAdvances: SalaryAdvance[];
  salaryPayments: SalaryPayment[];
  canCreate?: boolean;
  canEdit?: boolean;
  canPay?: boolean;
  canExport?: boolean;
  lang: Language;
  onCreateEmployee: (payload: EmployeeFormPayload) => Promise<void>;
  onUpdateEmployee: (id: string, payload: EmployeeFormPayload) => Promise<void>;
  onRecordAdvance: (params: {
    employeeId: string;
    amountTnd: number;
    advanceDate: string;
    paymentMode: 'ESPECES' | 'CHEQUE' | 'VIREMENT';
    notes?: string;
  }) => Promise<SalaryAdvance>;
  onRecordSettlement: (params: {
    employeeId: string;
    periodMonth: string;
    paymentDate: string;
    paymentMode: 'ESPECES' | 'CHEQUE' | 'VIREMENT';
    notes?: string;
  }) => Promise<SalaryPayment>;
  onPrintAdvance: (adv: SalaryAdvance) => void;
  onPrintSettlement: (pay: SalaryPayment) => void;
  onExportExcel: () => void;
}

function formatDateSafe(val?: string | null): string {
  if (!val) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-');
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(val);
  return Number.isNaN(dt.getTime()) ? val : dt.toLocaleDateString('fr-TN');
}

export const PersonnelManager: React.FC<PersonnelManagerProps> = ({
  employees,
  salaryAdvances,
  salaryPayments,
  canCreate = false,
  canEdit = false,
  canPay = false,
  canExport = false,
  onCreateEmployee,
  onUpdateEmployee,
  onRecordAdvance,
  onRecordSettlement,
  onPrintAdvance,
  onPrintSettlement,
  onExportExcel,
}) => {
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [periodMonth, setPeriodMonth] = useState<string>(currentMonthStr);
  const [activeTab, setActiveTab] = useState<'PAYROLL' | 'EMPLOYEES' | 'HISTORY'>('PAYROLL');

  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [advanceModalPreselectId, setAdvanceModalPreselectId] = useState<string | undefined>(
    undefined
  );
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [settlingEmployee, setSettlingEmployee] = useState<Employee | null>(null);

  const activeEmployees = employees.filter((e) => e.is_active);
  const monthAdvances = salaryAdvances.filter((a) => a.period_month === periodMonth);
  const monthPayments = salaryPayments.filter((p) => p.period_month === periodMonth);

  const totalBasePayroll = activeEmployees.reduce(
    (sum, e) => sum + Number(e.base_salary_tnd || 0),
    0
  );
  const totalMonthAdvances = monthAdvances.reduce(
    (sum, a) => sum + Number(a.amount_tnd || 0),
    0
  );
  const totalMonthNetPaid = monthPayments.reduce(
    (sum, p) => sum + Number(p.net_paid_tnd || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 font-medium block">Effectif Actif</span>
            <span className="font-mono text-2xl font-black text-stone-900">
              {activeEmployees.length} / {employees.length}
            </span>
          </div>
          <div className="p-2.5 bg-stone-100 text-stone-700 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 font-medium block">Masse Salariale Base</span>
            <span className="font-mono text-2xl font-black text-stone-900">
              {totalBasePayroll.toFixed(3)} TND
            </span>
          </div>
          <div className="p-2.5 bg-stone-100 text-stone-700 rounded-lg">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 font-medium block">
              Avances ({periodMonth})
            </span>
            <span className="font-mono text-2xl font-black text-amber-800">
              {totalMonthAdvances.toFixed(3)} TND
            </span>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg">
            <Banknote className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 font-medium block">
              Soldes Versés ({periodMonth})
            </span>
            <span className="font-mono text-2xl font-black text-emerald-800">
              {totalMonthNetPaid.toFixed(3)} TND
            </span>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('PAYROLL')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'PAYROLL'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            Paie Mensuelle ({periodMonth})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('EMPLOYEES')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'EMPLOYEES'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            Employés ({employees.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            Historique Avances &amp; Règlements ({salaryAdvances.length + salaryPayments.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-300 rounded-lg px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-stone-500" />
            <input
              type="month"
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value || currentMonthStr)}
              className="text-xs font-mono font-bold text-stone-800 bg-transparent focus:outline-none"
            />
          </div>

          {canExport && (
            <button
              type="button"
              onClick={onExportExcel}
              className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Excel</span>
            </button>
          )}

          {canCreate && (
            <>
              <button
                type="button"
                onClick={() => {
                  setAdvanceModalPreselectId(activeEmployees[0]?.id);
                  setIsAdvanceModalOpen(true);
                }}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Banknote className="w-4 h-4" />
                <span>Nouvelle Avance</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingEmployee(null);
                  setIsEmpModalOpen(true);
                }}
                className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nouvel Employé</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: Monthly Payroll Table */}
      {activeTab === 'PAYROLL' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-stone-800">
              Calcul &amp; Règlement de Paie — Période {periodMonth}
            </h3>
            <span className="text-[11px] text-stone-500">
              Formule : Salaire Base − Avances ({periodMonth}) − Paiements Précédents = Net à Payer
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200 uppercase text-[11px]">
                <tr>
                  <th className="p-3.5">Employé</th>
                  <th className="p-3.5">Poste</th>
                  <th className="p-3.5 text-right">Salaire Base</th>
                  <th className="p-3.5 text-right">Avances ({periodMonth})</th>
                  <th className="p-3.5 text-right">Déjà Payé</th>
                  <th className="p-3.5 text-right">Net à Payer</th>
                  <th className="p-3.5 text-center">Statut</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {activeEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-stone-400 italic">
                      Aucun employé actif enregistré. Cliquez sur &quot;Nouvel Employé&quot;.
                    </td>
                  </tr>
                ) : (
                  activeEmployees.map((emp) => {
                    const empAdvances = monthAdvances.filter((a) => a.employee_id === emp.id);
                    const empSettlements = monthPayments.filter((p) => p.employee_id === emp.id);
                    const sumAdv = empAdvances.reduce(
                      (sum, a) => sum + Number(a.amount_tnd || 0),
                      0
                    );
                    const sumPrevPay = empSettlements.reduce(
                      (sum, p) => sum + Number(p.net_paid_tnd || 0),
                      0
                    );
                    const netRemaining = Math.max(
                      0,
                      Math.round((Number(emp.base_salary_tnd) - sumAdv - sumPrevPay) * 1000) / 1000
                    );
                    const settledRecord = empSettlements[0];

                    return (
                      <tr key={emp.id} className="hover:bg-stone-50 transition-colors">
                        <td className="p-3.5">
                          <span className="font-bold text-stone-900 block">{emp.full_name}</span>
                          <span className="font-mono text-[10px] text-stone-500">{emp.code}</span>
                        </td>
                        <td className="p-3.5 text-stone-700 font-medium">{emp.role_title}</td>
                        <td className="p-3.5 text-right font-mono font-bold text-stone-900">
                          {Number(emp.base_salary_tnd).toFixed(3)} TND
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-amber-800">
                          {sumAdv > 0 ? `-${sumAdv.toFixed(3)}` : '0.000'} TND
                        </td>
                        <td className="p-3.5 text-right font-mono text-stone-600">
                          {sumPrevPay.toFixed(3)} TND
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-emerald-800 text-sm">
                          {settledRecord ? '0.000' : netRemaining.toFixed(3)} TND
                        </td>
                        <td className="p-3.5 text-center">
                          {settledRecord ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3" />
                              Réglé ({settledRecord.doc_number})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                              <Clock className="w-3 h-3" />À régler
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {!settledRecord && canCreate && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAdvanceModalPreselectId(emp.id);
                                  setIsAdvanceModalOpen(true);
                                }}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-bold cursor-pointer"
                              >
                                + Avance
                              </button>
                            )}
                            {!settledRecord && canPay && (
                              <button
                                type="button"
                                onClick={() => setSettlingEmployee(emp)}
                                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[11px] font-bold cursor-pointer"
                              >
                                Régler Salaire
                              </button>
                            )}
                            {settledRecord && (
                              <button
                                type="button"
                                onClick={() => onPrintSettlement(settledRecord)}
                                className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Printer className="w-3 h-3" />
                                <span>Bulletin</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Employee Directory */}
      {activeTab === 'EMPLOYEES' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200 uppercase text-[11px]">
                <tr>
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Nom Complet</th>
                  <th className="p-3.5">Poste</th>
                  <th className="p-3.5">Téléphone</th>
                  <th className="p-3.5 text-right">Salaire Base</th>
                  <th className="p-3.5">Embauche</th>
                  <th className="p-3.5">Statut</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-stone-400 italic">
                      Aucun employé enregistré.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-stone-50">
                      <td className="p-3.5 font-mono font-bold text-stone-700">{emp.code}</td>
                      <td className="p-3.5 font-bold text-stone-900">{emp.full_name}</td>
                      <td className="p-3.5 text-stone-700">{emp.role_title}</td>
                      <td className="p-3.5 font-mono text-stone-600">{emp.phone || '-'}</td>
                      <td className="p-3.5 text-right font-mono font-bold text-stone-900">
                        {Number(emp.base_salary_tnd).toFixed(3)} TND
                      </td>
                      <td className="p-3.5 font-mono text-stone-500">
                        {formatDateSafe(emp.hire_date)}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            emp.is_active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-stone-200 text-stone-600'
                          }`}
                        >
                          {emp.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEmployee(emp);
                              setIsEmpModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-blue-50 text-blue-700 border border-blue-200 rounded cursor-pointer"
                            title="Modifier la fiche employé"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Advances & Settlements History */}
      {activeTab === 'HISTORY' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Advances List */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
            <div className="p-4 bg-stone-50 border-b border-stone-200 font-bold text-xs uppercase text-stone-800">
              Bons d&apos;Avance Horodatés (BON-ADV · {salaryAdvances.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 text-stone-700 font-bold text-[10px] uppercase">
                  <tr>
                    <th className="p-3">N° Bon &amp; Date</th>
                    <th className="p-3">Employé</th>
                    <th className="p-3 text-right">Montant</th>
                    <th className="p-3">Statut</th>
                    <th className="p-3 text-right">Impr.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {salaryAdvances.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-stone-400 italic">
                        Aucune avance accordée.
                      </td>
                    </tr>
                  ) : (
                    salaryAdvances.map((a) => (
                      <tr key={a.id} className="hover:bg-stone-50">
                        <td className="p-3">
                          <span className="font-mono font-bold text-stone-900 block">
                            {a.doc_number}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono">
                            {formatDateSafe(a.advance_date)} ({a.period_month})
                          </span>
                        </td>
                        <td className="p-3 font-bold text-stone-800">{a.employee_name}</td>
                        <td className="p-3 text-right font-mono font-bold text-amber-900">
                          {Number(a.amount_tnd).toFixed(3)} TND
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              a.is_settled
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {a.is_settled ? 'Soldé' : 'En cours'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => onPrintAdvance(a)}
                            className="p-1.5 border border-stone-200 rounded hover:bg-stone-100 text-stone-700 cursor-pointer"
                            title="Imprimer le reçu d'avance"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Settlements List */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
            <div className="p-4 bg-stone-50 border-b border-stone-200 font-bold text-xs uppercase text-stone-800">
              Règlements Mensuels Clôturés (BON-PAY · {salaryPayments.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 text-stone-700 font-bold text-[10px] uppercase">
                  <tr>
                    <th className="p-3">N° Bon &amp; Mois</th>
                    <th className="p-3">Employé</th>
                    <th className="p-3 text-right">Net Versé</th>
                    <th className="p-3 text-right">Impr.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {salaryPayments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-stone-400 italic">
                        Aucun règlement mensuel clôturé.
                      </td>
                    </tr>
                  ) : (
                    salaryPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-stone-50">
                        <td className="p-3">
                          <span className="font-mono font-bold text-stone-900 block">
                            {p.doc_number}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono">
                            Mois {p.period_month} · {formatDateSafe(p.payment_date)}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-stone-800 block">{p.employee_name}</span>
                          <span className="text-[10px] text-stone-500 font-mono">
                            Base {Number(p.base_salary_tnd).toFixed(3)} − Avances{' '}
                            {Number(p.total_advances_tnd).toFixed(3)}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-black text-emerald-800">
                          {Number(p.net_paid_tnd).toFixed(3)} TND
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => onPrintSettlement(p)}
                            className="p-1.5 border border-stone-200 rounded hover:bg-stone-100 text-stone-700 cursor-pointer"
                            title="Imprimer le bulletin / reçu de salaire"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {isEmpModalOpen && (
        <EmployeeModal
          employee={editingEmployee}
          onClose={() => {
            setIsEmpModalOpen(false);
            setEditingEmployee(null);
          }}
          onSubmit={async (payload) => {
            if (editingEmployee) {
              await onUpdateEmployee(editingEmployee.id, payload);
            } else {
              await onCreateEmployee(payload);
            }
          }}
        />
      )}

      {isAdvanceModalOpen && (
        <AdvanceModal
          employees={employees}
          preselectedEmployeeId={advanceModalPreselectId}
          salaryAdvances={salaryAdvances}
          salaryPayments={salaryPayments}
          onClose={() => setIsAdvanceModalOpen(false)}
          onSubmit={async (params) => {
            const adv = await onRecordAdvance(params);
            onPrintAdvance(adv);
          }}
        />
      )}

      {settlingEmployee && (
        <PayrollSettlementModal
          employee={settlingEmployee}
          periodMonth={periodMonth}
          monthAdvances={monthAdvances.filter((a) => a.employee_id === settlingEmployee.id)}
          previousSettlements={monthPayments.filter(
            (p) => p.employee_id === settlingEmployee.id
          )}
          onClose={() => setSettlingEmployee(null)}
          onSubmit={async (params) => {
            const pay = await onRecordSettlement(params);
            onPrintSettlement(pay);
          }}
        />
      )}
    </div>
  );
};

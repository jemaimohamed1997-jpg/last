import React, { useState } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Plus,
  FileSpreadsheet,
  Receipt,
  Tag,
  AlertCircle,
  RefreshCw,
  Users,
} from 'lucide-react';
import {
  ProductionBatch,
  GrignonSale,
  PurchaseBatch,
  ExpenseItem,
  OliveReception,
  ReceptionPayment,
  SalaryAdvance,
  SalaryPayment,
} from '../../types/production';
import { Language } from '../../lib/i18n';

export type ExpenseCreateInput = Omit<ExpenseItem, 'id' | 'created_at'>;

interface FinancesManagerProps {
  receptions?: OliveReception[];
  receptionPayments?: ReceptionPayment[];
  productionBatches: ProductionBatch[];
  grignonSales: GrignonSale[];
  purchases: PurchaseBatch[];
  expenses: ExpenseItem[];
  salaryAdvances?: SalaryAdvance[];
  salaryPayments?: SalaryPayment[];
  canCreate?: boolean;
  canExport?: boolean;
  currentOperator: string;
  lang: Language;
  onAddExpense: (expense: ExpenseCreateInput) => Promise<void>;
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

export const FinancesManager: React.FC<FinancesManagerProps> = ({
  receptions = [],
  receptionPayments = [],
  grignonSales,
  purchases,
  expenses,
  salaryAdvances = [],
  salaryPayments = [],
  canCreate = false,
  canExport = false,
  currentOperator,
  lang,
  onAddExpense,
  onExportExcel,
}) => {
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expCategory, setExpCategory] =
    useState<ExpenseItem['category']>('ENERGIE_ELECTRICITE');
  const [expLabel, setExpLabel] = useState('');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expBeneficiary, setExpBeneficiary] = useState('');
  const [expPaymentMode, setExpPaymentMode] =
    useState<ExpenseItem['payment_mode']>('ESPECES');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'RECEPTIONS_CASH' | 'EXPENSES' | 'PAYROLL'
  >('OVERVIEW');

  // 1. Réceptions Olives
  const receptionsFactureTotal = receptions.reduce(
    (sum, r) => sum + Number(r.total_milling_fee_tnd || 0),
    0
  );
  const receptionsEncaisseReel = receptionPayments.reduce(
    (sum, p) => sum + Number(p.amount_tnd || 0),
    0
  );
  const receptionsEncaisseCash = receptionPayments
    .filter((p) => p.payment_mode === 'ESPECES')
    .reduce((sum, p) => sum + Number(p.amount_tnd || 0), 0);
  const receptionsRestantAEncaisser = receptions.reduce(
    (sum, r) => sum + Number(r.remaining_amount_tnd || 0),
    0
  );

  const receptionsPayesCount = receptions.filter((r) => r.payment_status === 'PAYE').length;
  const receptionsPartielsCount = receptions.filter((r) => r.payment_status === 'PARTIEL').length;
  const receptionsImpayesCount = receptions.filter((r) => r.payment_status === 'IMPAYE').length;

  // 2. Grignons
  const grignonRevenue = grignonSales
    .filter((s) => s.payment_status === 'PAYE')
    .reduce((acc, s) => acc + Number(s.total_price_tnd || 0), 0);

  const grignonUnpaid = grignonSales
    .filter((s) => s.payment_status === 'IMPAYE')
    .reduce((acc, s) => acc + Number(s.total_price_tnd || 0), 0);

  // 3. Décaissements réels (Achats payés + Charges + Masse salariale)
  const purchasesOutflow = purchases
    .filter((p) => p.payment_status === 'PAYE')
    .reduce((acc, p) => acc + Number(p.total_price_tnd || 0), 0);

  const expensesOutflow = expenses.reduce((acc, e) => acc + Number(e.amount_tnd || 0), 0);

  const advancesOutflow = salaryAdvances.reduce((acc, a) => acc + Number(a.amount_tnd || 0), 0);
  const netSalariesOutflow = salaryPayments.reduce(
    (acc, p) => acc + Number(p.net_paid_tnd || 0),
    0
  );
  const payrollOutflow = advancesOutflow + netSalariesOutflow;

  // 4. Totaux de trésorerie RÉELLE
  const totalInflows = receptionsEncaisseReel + grignonRevenue;
  const totalOutflows = purchasesOutflow + expensesOutflow + payrollOutflow;
  const netCashflow = totalInflows - totalOutflows;

  const totalCreancesGlobales = receptionsRestantAEncaisser + grignonUnpaid;

  // Daily Cash breakdown from receptionPayments
  const dailyCashBreakdown = React.useMemo(() => {
    const map = new Map<
      string,
      { total: number; count: number; especes: number; cheques: number }
    >();
    receptionPayments.forEach((p) => {
      const d = p.payment_date || p.created_at.slice(0, 10);
      const curr = map.get(d) || { total: 0, count: 0, especes: 0, cheques: 0 };
      curr.total += Number(p.amount_tnd || 0);
      curr.count += 1;
      if (p.payment_mode === 'ESPECES') curr.especes += Number(p.amount_tnd || 0);
      else curr.cheques += Number(p.amount_tnd || 0);
      map.set(d, curr);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, data]) => ({ date, ...data }));
  }, [receptionPayments]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError(null);

    const parsedAmount = Number(expAmount);
    if (!expLabel.trim()) {
      setExpenseError('Veuillez saisir le libellé de la dépense.');
      return;
    }
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setExpenseError('Veuillez saisir un montant valide (> 0).');
      return;
    }

    setIsSubmittingExpense(true);
    try {
      await onAddExpense({
        date: expDate || new Date().toISOString().slice(0, 10),
        category: expCategory,
        label: expLabel.trim(),
        amount_tnd: Math.round(parsedAmount * 1000) / 1000,
        beneficiary: expBeneficiary.trim() || undefined,
        payment_mode: expPaymentMode,
        operator: currentOperator,
      });
      setIsExpenseModalOpen(false);
      setExpLabel('');
      setExpAmount('');
      setExpBeneficiary('');
    } catch (err: any) {
      setExpenseError(err?.message || "Erreur lors de l'enregistrement de la dépense.");
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Top KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Recettes Réelles Encaissées */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              {lang === 'ar' ? 'المقابيض الفعلية بالصندوق' : 'Recettes Réelles Encaissées'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono">
            {totalInflows.toLocaleString(undefined, {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })}{' '}
            <span className="text-xs font-normal text-stone-500">TND</span>
          </div>
          <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-2 flex-wrap">
            <span>Réceptions: {receptionsEncaisseReel.toFixed(3)}</span> &bull;{' '}
            <span>Grignons: {grignonRevenue.toFixed(3)}</span>
          </div>
        </div>

        {/* Total Décaissements (Achats + Charges + Salaires) */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              {lang === 'ar'
                ? 'المصاريف والمشتريات والأجور'
                : 'Décaissements (Achats, Charges, Paie)'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4 text-rose-600" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono">
            {totalOutflows.toLocaleString(undefined, {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })}{' '}
            <span className="text-xs font-normal text-stone-500">TND</span>
          </div>
          <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-1.5 flex-wrap">
            <span>Achats: {purchasesOutflow.toFixed(3)}</span> &bull;{' '}
            <span>Charges: {expensesOutflow.toFixed(3)}</span> &bull;{' '}
            <span>Paie: {payrollOutflow.toFixed(3)}</span>
          </div>
        </div>

        {/* Solde Net de Caisse */}
        <div
          className={`p-5 rounded-2xl border shadow-2xs ${
            netCashflow >= 0
              ? 'bg-gradient-to-br from-stone-900 via-stone-900 to-emerald-950 text-white border-stone-800'
              : 'bg-gradient-to-br from-stone-900 via-stone-900 to-rose-950 text-white border-rose-900'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
              {lang === 'ar' ? 'السيولة الصافية بالصندوق' : 'Solde Net de Caisse'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono">
            {netCashflow.toLocaleString(undefined, {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })}{' '}
            <span className="text-xs font-normal text-stone-300">TND</span>
          </div>
          <div className="text-[11px] text-stone-300 mt-1">
            {netCashflow >= 0 ? '✓ Trésorerie positive' : '⚠ Trésorerie négative'}
          </div>
        </div>

        {/* Créances à Recouvrer */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              {lang === 'ar' ? 'مستحقات معلقة بالذمة' : 'Créances Clients à Recouvrer'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 font-mono">
            {totalCreancesGlobales.toLocaleString(undefined, {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })}{' '}
            <span className="text-xs font-normal text-stone-500">TND</span>
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            Réceptions: {receptionsRestantAEncaisser.toFixed(3)} · Grignons: {grignonUnpaid.toFixed(3)}
          </div>
        </div>
      </div>

      {/* 2. Synthèse Détaillée Réceptions Olives */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-stone-100">
          <div>
            <h3 className="font-extrabold text-sm text-stone-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-600" />
              <span>Synthèse Financière des Réceptions d&apos;Olives</span>
            </h3>
            <p className="text-xs text-stone-500">
              Rapprochement entre facturation de trituration et encaissements effectifs
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg">
              {receptionsPayesCount} Soldés
            </span>
            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-lg">
              {receptionsPartielsCount} Partiels
            </span>
            <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold rounded-lg">
              {receptionsImpayesCount} Impayés
            </span>
            {canExport && (
              <button
                type="button"
                onClick={onExportExcel}
                className="px-3 py-1 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg text-xs font-sans font-bold text-stone-700 flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Exporter Bilan</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-xs text-stone-500 font-bold uppercase block">
              1. Total Facturé (Théorique)
            </span>
            <span className="font-mono text-2xl font-black text-stone-900 block mt-1">
              {receptionsFactureTotal.toFixed(3)}{' '}
              <span className="text-xs font-normal text-stone-500">TND</span>
            </span>
          </div>

          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-xs text-emerald-800 font-bold uppercase block">
              2. Total Réellement Encaissé
            </span>
            <span className="font-mono text-2xl font-black text-emerald-900 block mt-1">
              {receptionsEncaisseReel.toFixed(3)}{' '}
              <span className="text-xs font-normal text-emerald-700">TND</span>
            </span>
            <span className="text-[11px] text-emerald-700 mt-0.5 block">
              Dont {receptionsEncaisseCash.toFixed(3)} TND en espèces
            </span>
          </div>

          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
            <span className="text-xs text-amber-900 font-bold uppercase block">
              3. Reste à Encaisser (Créances)
            </span>
            <span className="font-mono text-2xl font-black text-amber-950 block mt-1">
              {receptionsRestantAEncaisser.toFixed(3)}{' '}
              <span className="text-xs font-normal text-amber-800">TND</span>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'OVERVIEW'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          Journal des Encaissements ({receptionPayments.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('RECEPTIONS_CASH')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'RECEPTIONS_CASH'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          Récapitulatif Journalier
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('EXPENSES')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'EXPENSES'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          Charges &amp; Dépenses ({expenses.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PAYROLL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'PAYROLL'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Salaires &amp; Avances ({salaryAdvances.length + salaryPayments.length})</span>
        </button>
      </div>

      {/* TAB 1: Journal des Versements Réceptions */}
      {activeTab === 'OVERVIEW' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-stone-800">
              Historique des Versements Reçus (Bons de Réception)
            </h3>
            <span className="font-mono text-xs text-stone-500">
              Total perçu : {receptionsEncaisseReel.toFixed(3)} TND
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-stone-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">N° Bon</th>
                  <th className="p-3">Client / Producteur</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3">Référence</th>
                  <th className="p-3">Opérateur</th>
                  <th className="p-3 text-right">Montant Encaissé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium">
                {receptionPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-stone-400 italic">
                      Aucun versement enregistré pour l&apos;instant.
                    </td>
                  </tr>
                ) : (
                  receptionPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                      <td className="p-3 font-mono text-stone-600">
                        {formatDateSafe(p.payment_date || p.created_at.slice(0, 10))}
                      </td>
                      <td className="p-3 font-mono font-bold text-stone-900">
                        {p.ticket_number}
                      </td>
                      <td className="p-3 font-bold text-stone-800">{p.party_name}</td>
                      <td className="p-3">
                        <span className="font-mono text-[10px] bg-stone-100 px-2 py-0.5 rounded font-bold">
                          {p.payment_mode}
                        </span>
                      </td>
                      <td className="p-3 text-stone-500 font-mono text-[11px]">
                        {p.reference || '—'}
                      </td>
                      <td className="p-3 text-stone-600">{p.operator}</td>
                      <td className="p-3 text-right font-mono font-black text-emerald-700 text-sm">
                        +{Number(p.amount_tnd).toFixed(3)} TND
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Récapitulatif Journalier des Encaissements */}
      {activeTab === 'RECEPTIONS_CASH' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-stone-800">
              Encaissements Groupés par Journée
            </h3>
            <span className="font-mono text-xs text-stone-500">
              {dailyCashBreakdown.length} journée(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-stone-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-center">Nombre Versements</th>
                  <th className="p-3 text-right">Espèces (TND)</th>
                  <th className="p-3 text-right">Chèques / Autres (TND)</th>
                  <th className="p-3 text-right text-emerald-800 font-bold">
                    Total Encaissé (TND)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium">
                {dailyCashBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-stone-400 italic">
                      Aucun encaissement journalier à afficher.
                    </td>
                  </tr>
                ) : (
                  dailyCashBreakdown.map((row) => (
                    <tr key={row.date} className="hover:bg-stone-50">
                      <td className="p-3 font-mono font-bold text-stone-900">
                        {formatDateSafe(row.date)}
                      </td>
                      <td className="p-3 text-center font-mono">{row.count}</td>
                      <td className="p-3 text-right font-mono text-stone-800">
                        {row.especes.toFixed(3)}
                      </td>
                      <td className="p-3 text-right font-mono text-stone-600">
                        {row.cheques.toFixed(3)}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-emerald-700 text-sm">
                        +{row.total.toFixed(3)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Charges & Dépenses d'Exploitation */}
      {activeTab === 'EXPENSES' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-sm text-stone-900">
                Journal des Charges d’Exploitation de l’Huilerie
              </h3>
              <p className="text-xs text-stone-500">
                Suivi des dépenses courantes (électricité STEG, maintenance, transport, divers)
              </p>
            </div>

            <div className="flex items-center gap-2">
              {canExport && (
                <button
                  type="button"
                  onClick={onExportExcel}
                  className="px-3 py-2 border border-stone-300 hover:bg-stone-50 rounded-lg text-xs font-bold text-stone-700 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline">Exporter Synthèse</span>
                </button>
              )}

              {canCreate && (
                <button
                  type="button"
                  onClick={() => {
                    setExpenseError(null);
                    setIsExpenseModalOpen(true);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Enregistrer une Charge</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-600">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-800 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Catégorie</th>
                    <th className="px-4 py-3">Libellé de la Dépense</th>
                    <th className="px-4 py-3">Bénéficiaire</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3 text-right">Montant (TND)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                        Aucune dépense d&apos;exploitation enregistrée pour l&apos;instant.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((e) => (
                      <tr key={e.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="px-4 py-3 text-stone-500 whitespace-nowrap font-mono">
                          {formatDateSafe(e.date)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-bold text-[10px]">
                            <Tag className="w-3 h-3 text-stone-500" />
                            {e.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-stone-900">{e.label}</td>
                        <td className="px-4 py-3 text-stone-600">{e.beneficiary || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-[10px] bg-stone-100 px-1.5 py-0.5 rounded font-bold">
                            {e.payment_mode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-rose-600 text-sm">
                          -{Number(e.amount_tnd).toFixed(3)}
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

      {/* TAB 4: Personnel Payroll Outflows */}
      {activeTab === 'PAYROLL' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-stone-800">
                Sorties de Caisse — Personnel &amp; Salaires ({payrollOutflow.toFixed(3)} TND)
              </h3>
              <p className="text-[11px] text-stone-500">
                Avances (BON-ADV : {advancesOutflow.toFixed(3)} TND) + Soldes Nets de Paie (BON-PAY :{' '}
                {netSalariesOutflow.toFixed(3)} TND)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-stone-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Type &amp; N° Bon</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Employé</th>
                  <th className="p-3">Période</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3 text-right">Sortie Caisse (TND)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {salaryAdvances.length === 0 && salaryPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-stone-400 italic">
                      Aucun versement salarial ou avance enregistré.
                    </td>
                  </tr>
                ) : (
                  [
                    ...salaryAdvances.map((a) => ({
                      id: a.id,
                      kind: 'Avance (BON-ADV)',
                      doc: a.doc_number,
                      date: a.advance_date,
                      emp: a.employee_name,
                      period: a.period_month,
                      mode: a.payment_mode,
                      amount: Number(a.amount_tnd || 0),
                    })),
                    ...salaryPayments.map((p) => ({
                      id: p.id,
                      kind: 'Solde Paie (BON-PAY)',
                      doc: p.doc_number,
                      date: p.payment_date,
                      emp: p.employee_name,
                      period: p.period_month,
                      mode: p.payment_mode,
                      amount: Number(p.net_paid_tnd || 0),
                    })),
                  ]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((row) => (
                      <tr key={row.id} className="hover:bg-stone-50">
                        <td className="p-3">
                          <span className="font-mono font-bold text-stone-900 block">
                            {row.doc}
                          </span>
                          <span className="text-[10px] text-stone-500">{row.kind}</span>
                        </td>
                        <td className="p-3 font-mono text-stone-600">{formatDateSafe(row.date)}</td>
                        <td className="p-3 font-bold text-stone-800">{row.emp}</td>
                        <td className="p-3 font-mono text-stone-600">{row.period}</td>
                        <td className="p-3">
                          <span className="font-mono text-[10px] bg-stone-100 px-2 py-0.5 rounded font-bold">
                            {row.mode}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-black text-rose-700">
                          -{row.amount.toFixed(3)} TND
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Add Expense */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden">
            <div className="bg-stone-900 px-6 py-4 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-sm">Nouvelle Dépense d’Exploitation</h3>
              <button
                type="button"
                disabled={isSubmittingExpense}
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="p-6 space-y-3.5">
              {expenseError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{expenseError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Catégorie *</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold"
                  >
                    <option value="ENERGIE_ELECTRICITE">Énergie &amp; Électricité (STEG)</option>
                    <option value="MAIN_DOEUVRE">Main d’œuvre saisonnière</option>
                    <option value="MAINTENANCE_PIECES">Maintenance &amp; Pièces</option>
                    <option value="EAU_ASSAINISSEMENT">Eau &amp; Lavage</option>
                    <option value="TRANSPORT">Carburant &amp; Transport</option>
                    <option value="DIVERS">Frais divers</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Libellé de la Dépense *
                </label>
                <input
                  type="text"
                  required
                  value={expLabel}
                  onChange={(e) => setExpLabel(e.target.value)}
                  placeholder="Ex: Facture STEG"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Montant (TND) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="Ex: 850.000"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-mono font-bold text-rose-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Mode de Paiement
                  </label>
                  <select
                    value={expPaymentMode}
                    onChange={(e) => setExpPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold"
                  >
                    <option value="ESPECES">Espèces</option>
                    <option value="CHEQUE">Chèque</option>
                    <option value="VIREMENT">Virement</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Bénéficiaire / Fournisseur
                </label>
                <input
                  type="text"
                  value={expBeneficiary}
                  onChange={(e) => setExpBeneficiary(e.target.value)}
                  placeholder="Ex: STEG"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  disabled={isSubmittingExpense}
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-stone-400 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingExpense && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Enregistrer la Dépense</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

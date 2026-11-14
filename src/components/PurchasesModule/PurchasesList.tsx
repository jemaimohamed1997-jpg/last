import React, { useState } from 'react';
import {
  Plus,
  FileSpreadsheet,
  Printer,
  Search,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { PurchaseBatch } from '../../types/production';
import { Language } from '../../lib/i18n';

interface PurchasesListProps {
  purchases: PurchaseBatch[];
  canCreate?: boolean;
  canPay?: boolean;
  canExport?: boolean;
  lang: Language;
  onNewPurchase: () => void;
  onTogglePaymentStatus?: (purchaseId: string, nextStatus: 'PAYE' | 'IMPAYE') => Promise<void>;
  onPrintPurchase: (purchase: PurchaseBatch) => void;
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

export const PurchasesList: React.FC<PurchasesListProps> = ({
  purchases,
  canCreate = false,
  canPay = false,
  canExport = false,
  lang,
  onNewPurchase,
  onTogglePaymentStatus,
  onPrintPurchase,
  onExportExcel,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      p.doc_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'ALL' || p.item_type === filterType;
    return matchesSearch && matchesType;
  });

  const totalOlivesKg = purchases
    .filter((p) => p.item_type === 'OLIVES')
    .reduce((acc, p) => acc + Number(p.quantity || 0), 0);

  const totalOilLitres = purchases
    .filter((p) => p.item_type === 'HUILE_VRAC')
    .reduce((acc, p) => acc + Number(p.quantity || 0), 0);

  const totalAmountTnd = purchases.reduce((acc, p) => acc + Number(p.total_price_tnd || 0), 0);
  const totalUnpaidTnd = purchases
    .filter((p) => p.payment_status === 'IMPAYE')
    .reduce((acc, p) => acc + Number(p.total_price_tnd || 0), 0);

  const handleTogglePay = async (p: PurchaseBatch) => {
    if (!onTogglePaymentStatus || !canPay) return;
    const nextStatus = p.payment_status === 'PAYE' ? 'IMPAYE' : 'PAYE';
    setUpdatingId(p.id);
    try {
      await onTogglePaymentStatus(p.id, nextStatus);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
            {lang === 'ar' ? 'إجمالي شراء الزيتون' : 'Olives Achetées'}
          </span>
          <span className="text-xl sm:text-2xl font-black text-stone-900 font-mono mt-1 block">
            {totalOlivesKg.toLocaleString()}{' '}
            <span className="text-xs font-normal text-stone-500">KG</span>
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
            {lang === 'ar' ? 'إجمالي شراء الزيت الصافي' : 'Huile Achetée en Vrac'}
          </span>
          <span className="text-xl sm:text-2xl font-black text-amber-600 font-mono mt-1 block">
            {totalOilLitres.toLocaleString()}{' '}
            <span className="text-xs font-normal text-stone-500">L</span>
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
            {lang === 'ar' ? 'إجمالي المبالغ المصروفة' : 'Dépenses Totales d’Achat'}
          </span>
          <span className="text-xl sm:text-2xl font-black text-rose-600 font-mono mt-1 block">
            {totalAmountTnd.toLocaleString(undefined, {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })}{' '}
            <span className="text-xs font-normal text-stone-500">TND</span>
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
            {lang === 'ar' ? 'المستحقات غير الخالصة' : 'En Attente de Règlement'}
          </span>
          <span className="text-xl sm:text-2xl font-black text-amber-500 font-mono mt-1 block">
            {totalUnpaidTnd.toLocaleString(undefined, {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })}{' '}
            <span className="text-xs font-normal text-stone-500">TND</span>
          </span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par n° de bon ou fournisseur..."
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-bold text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">Tous les produits</option>
            <option value="OLIVES">Olives seules</option>
            <option value="HUILE_VRAC">Huile seule</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {canExport && (
            <button
              type="button"
              onClick={onExportExcel}
              className="px-3 py-2 border border-stone-300 hover:bg-stone-50 rounded-lg text-xs font-bold text-stone-700 flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Exporter Excel</span>
            </button>
          )}

          {canCreate && (
            <button
              type="button"
              onClick={onNewPurchase}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvel Achat (BON-ACH)</span>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-600">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-800 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">N° Bon</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Fournisseur</th>
                <th className="px-4 py-3">Produit</th>
                <th className="px-4 py-3 text-right">Quantité</th>
                <th className="px-4 py-3 text-right">Prix Unitaire</th>
                <th className="px-4 py-3 text-right">Total (TND)</th>
                <th className="px-4 py-3 text-center">Règlement</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-stone-400">
                    Aucun bon d&apos;achat enregistré pour le moment.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-stone-900">
                      {p.doc_number}
                    </td>
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                      {formatDateSafe(p.date)}
                    </td>
                    <td className="px-4 py-3 font-bold text-stone-800">
                      {p.supplier_name}
                      {p.supplier_phone && (
                        <span className="block text-[10px] text-stone-400 font-normal">
                          {p.supplier_phone}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.item_type === 'OLIVES'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.item_type === 'OLIVES' ? 'Olives' : 'Huile Vrac'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-stone-900">
                      {Number(p.quantity).toLocaleString()}{' '}
                      <span className="text-[10px] text-stone-400 font-normal">
                        {p.item_type === 'OLIVES' ? 'KG' : 'L'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-stone-600">
                      {Number(p.unit_price_tnd).toFixed(3)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                      {Number(p.total_price_tnd).toFixed(3)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.payment_status === 'PAYE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {p.payment_status === 'PAYE' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Clock className="w-3 h-3 text-amber-600" />
                        )}
                        <span>{p.payment_status === 'PAYE' ? 'Payé' : 'Impayé'}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {canPay && onTogglePaymentStatus && (
                          <button
                            type="button"
                            disabled={updatingId === p.id}
                            onClick={() => handleTogglePay(p)}
                            className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer ${
                              p.payment_status === 'PAYE'
                                ? 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                                : 'bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-600'
                            }`}
                          >
                            {updatingId === p.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : p.payment_status === 'PAYE' ? (
                              'Impayé'
                            ) : (
                              'Régler'
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onPrintPurchase(p)}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 rounded text-stone-700 font-bold inline-flex items-center gap-1 text-[11px] transition cursor-pointer"
                          title="Imprimer le bon d'achat"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Bon</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

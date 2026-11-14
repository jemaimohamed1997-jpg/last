import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Search,
  Printer,
  FileSpreadsheet,
  DollarSign,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { GrignonSale } from '../../types/production';
import { Language } from '../../lib/i18n';

interface GrignonsSalesListProps {
  sales: GrignonSale[];
  canCreate?: boolean;
  canPay?: boolean;
  canExport?: boolean;
  lang: Language;
  onNewSale: () => void;
  onTogglePaymentStatus?: (saleId: string, nextStatus: 'PAYE' | 'IMPAYE') => Promise<void>;
  onPrintSale: (sale: GrignonSale) => void;
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

export const GrignonsSalesList: React.FC<GrignonsSalesListProps> = ({
  sales,
  canCreate = false,
  canPay = false,
  canExport = false,
  onNewSale,
  onTogglePaymentStatus,
  onPrintSale,
  onExportExcel,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered = sales.filter(
    (s) =>
      s.buyer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.truck_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.doc_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalTonnes = sales.reduce((sum, s) => sum + Number(s.net_weight_tonnes || 0), 0);
  const totalRevenueTnd = sales.reduce((sum, s) => sum + Number(s.total_price_tnd || 0), 0);
  const paidRevenueTnd = sales
    .filter((s) => s.payment_status === 'PAYE')
    .reduce((sum, s) => sum + Number(s.total_price_tnd || 0), 0);
  const unpaidRevenueTnd = Math.max(0, totalRevenueTnd - paidRevenueTnd);

  const handleTogglePay = async (s: GrignonSale) => {
    if (!onTogglePaymentStatus || !canPay) return;
    const nextStatus = s.payment_status === 'PAYE' ? 'IMPAYE' : 'PAYE';
    setUpdatingId(s.id);
    try {
      await onTogglePaymentStatus(s.id, nextStatus);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 font-medium block">Total Ventes Grignons</span>
            <span className="font-mono text-2xl font-black text-stone-900">{sales.length} bons</span>
          </div>
          <div className="p-2.5 bg-stone-100 text-stone-700 rounded-lg">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 font-medium block">Tonnage Total Évacué</span>
            <span className="font-mono text-2xl font-black text-amber-900">
              {totalTonnes.toFixed(2)} T
            </span>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 font-medium block">
              Chiffre d&apos;Affaires Grignons
            </span>
            <span className="font-mono text-2xl font-black text-emerald-800">
              {totalRevenueTnd.toFixed(3)} TND
            </span>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 font-medium block">Reste à Recouvrer</span>
            <span className="font-mono text-2xl font-black text-rose-700">
              {unpaidRevenueTnd.toFixed(3)} TND
            </span>
          </div>
          <div className="p-2.5 bg-rose-50 text-rose-700 rounded-lg">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Rechercher par acheteur, matricule camion, n° bon..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {canExport && (
            <button
              type="button"
              onClick={onExportExcel}
              className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Excel</span>
            </button>
          )}

          {canCreate && (
            <button
              type="button"
              onClick={onNewSale}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Bon de Vente</span>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">N° Bon &amp; Date</th>
                <th className="p-3.5">Acheteur / Usine</th>
                <th className="p-3.5">Matricule Camion</th>
                <th className="p-3.5 text-right">Poids Net</th>
                <th className="p-3.5 text-right">Prix Unitaire</th>
                <th className="p-3.5 text-right">Montant Total</th>
                <th className="p-3.5">Règlement</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length > 0 ? (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3.5">
                      <span className="font-mono font-bold text-stone-900 block">
                        {s.doc_number}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {formatDateSafe(s.date)}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <span className="font-bold text-stone-900 block">{s.buyer_name}</span>
                      {s.driver_name && (
                        <span className="text-[10px] text-stone-500">
                          Chauffeur: {s.driver_name}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 font-mono font-bold text-stone-700">{s.truck_plate}</td>

                    <td className="p-3.5 text-right">
                      <span className="font-mono font-black text-amber-950 text-sm block">
                        {Number(s.net_weight_tonnes).toFixed(3)} T
                      </span>
                      <span className="text-[10px] text-stone-400">
                        ({Number(s.net_weight_kg).toLocaleString()} KG)
                      </span>
                    </td>

                    <td className="p-3.5 text-right font-mono text-stone-700">
                      {s.price_unit === 'KG'
                        ? `${Number(s.unit_price_tnd).toFixed(3)} TND/kg`
                        : `${Number(s.unit_price_per_tonne_tnd).toFixed(3)} TND/T`}
                    </td>

                    <td className="p-3.5 text-right font-mono font-black text-emerald-800 text-sm">
                      {Number(s.total_price_tnd).toFixed(3)} TND
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded ${
                          s.payment_status === 'PAYE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {s.payment_status === 'PAYE' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {s.payment_status === 'PAYE' ? 'Payé' : 'Non Payé'} ({s.payment_mode})
                      </span>
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {canPay && onTogglePaymentStatus && (
                          <button
                            type="button"
                            disabled={updatingId === s.id}
                            onClick={() => handleTogglePay(s)}
                            className={`px-2 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                              s.payment_status === 'PAYE'
                                ? 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                                : 'bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-600'
                            }`}
                            title={
                              s.payment_status === 'PAYE'
                                ? 'Marquer comme impayé'
                                : 'Marquer comme payé'
                            }
                          >
                            {updatingId === s.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : s.payment_status === 'PAYE' ? (
                              'Impayé'
                            ) : (
                              'Encaisser'
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onPrintSale(s)}
                          className="p-1.5 hover:bg-stone-100 text-stone-600 hover:text-stone-900 border border-stone-200 rounded cursor-pointer"
                          title="Imprimer le bon de vente grignons"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-stone-400 italic">
                    Aucune vente de grignons enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Printer, X, FileText, Receipt, Info } from 'lucide-react';
import { AppSettings } from '../../types/stock';
import {
  OliveReception,
  ProductionBatch,
  GrignonSale,
  SalaryAdvance,
  SalaryPayment,
} from '../../types/production';
import { OIL_KG_TO_LITRES_FACTOR } from '../../lib/supabase';

export type PrintableDocType =
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'STOCK_TRANSFER'
  | 'OLIVE_RECEPTION'
  | 'PRODUCTION_TICKET'
  | 'GRIGNON_SALE'
  | 'PURCHASE_RECEIPT'
  | 'CLIENT_STATEMENT'
  | 'SALARY_ADVANCE'
  | 'SALARY_SETTLEMENT';

export type PrintFormat = 'A4' | 'RP80';

interface PrintDocumentProps {
  docType: PrintableDocType;
  settings: AppSettings;
  data: any;
  initialFormat?: PrintFormat;
  onClose: () => void;
}

export const PrintDocument: React.FC<PrintDocumentProps> = ({
  docType,
  settings,
  data,
  initialFormat = 'A4',
  onClose,
}) => {
  const [format, setFormat] = useState<PrintFormat>(initialFormat);
  const [showPrinterTips, setShowPrinterTips] = useState<boolean>(false);

  const handlePrint = () => {
    window.print();
  };

  const isOliveRec = docType === 'OLIVE_RECEPTION';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-area, #printable-area * {
            visibility: visible;
          }
          #printable-area {
            position: absolute;
            left: 0;
            top: 0;
            margin: 0;
            padding: ${format === 'RP80' ? '2mm' : '15mm'};
            width: ${format === 'RP80' ? '74mm' : '100%'};
            background: white !important;
            color: black !important;
          }
          @page {
            size: ${format === 'RP80' ? '80mm auto' : 'A4 portrait'};
            margin: ${format === 'RP80' ? '2mm' : '10mm'};
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        className={`bg-white text-stone-900 rounded-2xl shadow-2xl w-full my-4 overflow-hidden flex flex-col max-h-[94vh] border border-stone-200 ${
          format === 'RP80' ? 'max-w-md' : 'max-w-3xl'
        }`}
      >
        {/* Modal Toolbar */}
        <div className="no-print bg-stone-900 text-white px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <Printer className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-extrabold text-xs sm:text-sm block">
                {format === 'A4'
                  ? 'Aperçu Impression — Format A4 Officiel'
                  : 'Aperçu Impression — Ticket Thermique RP80 (80mm)'}
              </span>
              <span className="text-[10px] text-stone-400 font-mono">
                {data.ticket_number || data.doc_number || 'BON-OFFICIEL'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-stone-800 p-0.5 rounded-lg border border-stone-700 flex items-center">
              <button
                type="button"
                onClick={() => setFormat('A4')}
                className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                  format === 'A4'
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>A4</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('RP80')}
                className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                  format === 'RP80'
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Ticket 80 mm</span>
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors shadow-xs active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPrinterTips(!showPrinterTips)}
              className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-amber-300 transition cursor-pointer"
              title="Conseils de configuration imprimante RP80"
            >
              <Info className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showPrinterTips && (
          <div className="no-print bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 flex items-start justify-between gap-3">
            <div>
              <span className="font-bold block mb-0.5">Configuration recommandée pour l&apos;imprimante RP80 :</span>
              <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5">
                <li>Sélectionnez la taille de papier <strong>80 mm</strong> (ou rouleau de caisse).</li>
                <li>Réglez les marges sur <strong>« Aucune » (ou « Minimum »)</strong>.</li>
                <li>Cochez <strong>« Graphiques d&apos;arrière-plan »</strong> pour afficher les séparateurs nets.</li>
              </ul>
            </div>
            <button
              onClick={() => setShowPrinterTips(false)}
              className="text-amber-700 hover:text-amber-900 font-bold text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Printable Area */}
        <div className="p-4 sm:p-8 overflow-y-auto bg-stone-50 flex justify-center">
          <div
            id="printable-area"
            className={`bg-white shadow-xs rounded-lg p-6 sm:p-8 text-stone-900 ${
              format === 'RP80'
                ? 'w-full max-w-[320px] font-mono text-[11px] leading-tight border border-stone-300'
                : 'w-full max-w-2xl text-xs'
            }`}
          >
            {isOliveRec ? (
              format === 'RP80' ? (
                renderOliveReceptionRP80(data, settings)
              ) : (
                renderOliveReceptionA4(data, settings)
              )
            ) : (
              <>
                {/* Standard A4 Header */}
                <div className="border-b-2 border-stone-800 pb-4 mb-5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {settings.logo_url && (
                      <img
                        src={settings.logo_url}
                        alt={settings.company_name}
                        className="w-12 h-12 object-contain rounded-lg border border-stone-200 bg-white p-0.5 shrink-0"
                      />
                    )}
                    <div>
                      <h1 className="text-xl font-black tracking-tight text-stone-900">
                        {settings.company_name}
                      </h1>
                      <p className="text-sm font-arabic font-bold text-amber-700 mt-0.5" dir="rtl">
                        {settings.arabic_subtitle}
                      </p>
                      <p className="text-[11px] text-stone-500 mt-1">
                        {settings.address} · Tél: {settings.phone}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block px-2.5 py-1 bg-stone-100 border border-stone-300 font-mono text-xs font-bold rounded text-stone-800">
                      {data.doc_number || data.ticket_number || 'BON-OFFICIEL'}
                    </span>
                    <p className="text-[11px] text-stone-500 mt-1 font-mono">
                      Date:{' '}
                      {new Date(
                        data.date ||
                          data.advance_date ||
                          data.payment_date ||
                          data.operation_date ||
                          data.started_at ||
                          Date.now()
                      ).toLocaleDateString('fr-TN')}
                    </p>
                  </div>
                </div>

                {docType === 'STOCK_IN' &&
                  renderStockOperation(data, 'BON DE RÉCEPTION D’HUILE (ENTRÉE STOCK)', 'وصل إيداع زيت')}
                {docType === 'STOCK_OUT' &&
                  renderStockOperation(data, 'BON DE SORTIE D’HUILE (RETRAIT STOCK)', 'وصل تسليم زيت')}
                {docType === 'STOCK_TRANSFER' && renderStockTransfer(data)}
                {docType === 'PRODUCTION_TICKET' && renderProductionTicket(data)}
                {docType === 'GRIGNON_SALE' && renderGrignonSale(data)}
                {docType === 'PURCHASE_RECEIPT' && renderPurchaseReceipt(data)}
                {docType === 'CLIENT_STATEMENT' && renderClientStatement(data)}
                {docType === 'SALARY_ADVANCE' && renderSalaryAdvance(data)}
                {docType === 'SALARY_SETTLEMENT' && renderSalarySettlement(data)}

                {/* Footer Signatures */}
                <div className="mt-8 pt-5 border-t border-stone-300">
                  <div className="grid grid-cols-2 gap-6 text-center text-xs">
                    <div className="border border-stone-300 rounded-lg p-3 h-24 flex flex-col justify-between">
                      <span className="font-semibold text-stone-700">
                        {docType === 'SALARY_ADVANCE' || docType === 'SALARY_SETTLEMENT'
                          ? 'Signature de l’Employé / Bénéficiaire'
                          : 'Signature du Client / Fellaḥ'}
                      </span>
                      <span className="text-[10px] text-stone-400 font-arabic">
                        {docType === 'SALARY_ADVANCE' || docType === 'SALARY_SETTLEMENT'
                          ? 'توقيع العامل / المستفيد'
                          : 'توقيع الحريف / الفلاح'}
                      </span>
                    </div>
                    <div className="border border-stone-300 rounded-lg p-3 h-24 flex flex-col justify-between">
                      <span className="font-semibold text-stone-700">
                        Cachet &amp; Signature {settings.company_name}
                      </span>
                      <span className="text-[10px] text-stone-400 font-arabic">ختم وتوقيع المعصرة</span>
                    </div>
                  </div>
                  <div className="mt-4 text-center text-[9px] text-stone-400 font-mono">
                    Document officiel {settings.company_name} ERP · Traçabilité Conforme
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 1. BON DE RÉCEPTION OLIVES — FORMAT A4
// ==========================================
function renderOliveReceptionA4(rec: OliveReception, settings: AppSettings) {
  const recDateStr = rec.date
    ? new Date(rec.date).toLocaleDateString('fr-TN')
    : new Date().toLocaleDateString('fr-TN');
  const rem = Math.max(0, rec.remaining_amount_tnd || 0);

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-stone-800 pb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {settings.logo_url && (
            <img
              src={settings.logo_url}
              alt={settings.company_name}
              className="w-12 h-12 object-contain rounded-lg border border-stone-200 bg-white p-0.5 shrink-0"
            />
          )}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-stone-900">{settings.company_name}</h1>
            <p className="text-base font-arabic font-bold text-amber-700 mt-0.5" dir="rtl">
              {settings.arabic_subtitle}
            </p>
            <p className="text-xs text-stone-500 mt-1">
              {settings.address} · Tél: {settings.phone}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="inline-block px-3 py-1 bg-stone-100 border border-stone-300 font-mono text-sm font-black rounded text-stone-900">
            {rec.ticket_number}
          </span>
          <p className="text-xs text-stone-600 mt-1 font-mono font-bold">Date de Réception : {recDateStr}</p>
          <span
            className={`inline-block mt-1 px-2.5 py-0.5 text-[10px] font-bold rounded uppercase ${
              rec.payment_status === 'PAYE'
                ? 'bg-emerald-100 text-emerald-800'
                : rec.payment_status === 'PARTIEL'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            Statut :{' '}
            {rec.payment_status === 'PAYE'
              ? 'Payé'
              : rec.payment_status === 'PARTIEL'
              ? 'Partiellement Payé'
              : 'Impayé'}
          </span>
        </div>
      </div>

      <div className="bg-stone-100 p-3 rounded-lg border border-stone-200 flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-stone-900 tracking-tight">BON DE RÉCEPTION OLIVES &amp; PESÉE</h2>
          <p className="text-xs font-arabic font-bold text-amber-800" dir="rtl">
            وصل استلام ووزن الزيتون
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-stone-600">
          Opérateur : {rec.operator || 'Personnel Huilerie'}
        </span>
      </div>

      <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
        <h3 className="font-bold text-xs uppercase text-stone-600 mb-2 tracking-wider">
          Informations du Client / Producteur
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-stone-500 block text-[11px]">Producteur / Fellaḥ :</span>
            <span className="font-bold text-stone-900 text-sm">{rec.party_name}</span>
          </div>
          {rec.phone && (
            <div>
              <span className="text-stone-500 block text-[11px]">Téléphone :</span>
              <span className="font-mono font-semibold text-stone-800">{rec.phone}</span>
            </div>
          )}
          {rec.vehicle_plate && (
            <div>
              <span className="text-stone-500 block text-[11px]">Matricule Véhicule :</span>
              <span className="font-mono font-semibold text-stone-800">{rec.vehicle_plate}</span>
            </div>
          )}
          {rec.driver_name && (
            <div>
              <span className="text-stone-500 block text-[11px]">Chauffeur :</span>
              <span className="font-semibold text-stone-800">{rec.driver_name}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-stone-50 rounded-lg border border-stone-200 p-4">
        <h3 className="font-bold text-xs uppercase text-stone-600 mb-3 tracking-wider">Résultats de la Pesée</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-white rounded-lg border border-stone-200">
            <span className="text-[11px] text-stone-500 block">Poids Brut</span>
            <span className="font-mono font-bold text-stone-800 text-base">{rec.gross_weight_kg} KG</span>
          </div>
          <div className="p-3 bg-white rounded-lg border border-stone-200">
            <span className="text-[11px] text-stone-500 block">Tare Déduite</span>
            <span className="font-mono font-bold text-stone-600 text-base">{rec.tare_weight_kg} KG</span>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg border-2 border-amber-400">
            <span className="text-[11px] text-amber-900 block font-extrabold uppercase">Poids Net d&apos;Olives</span>
            <span className="font-mono font-black text-amber-950 text-xl">{rec.net_weight_kg} KG</span>
          </div>
        </div>
      </div>

      <div className="p-4 bg-stone-50 rounded-lg border border-stone-200 space-y-3">
        <h3 className="font-bold text-xs uppercase text-stone-600 tracking-wider">
          Décompte des Frais de Trituration
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-white rounded border border-stone-200">
            <span className="text-[10px] text-stone-500 block">Prix de Trituration</span>
            <span className="font-mono font-bold text-stone-900 text-sm">
              {(rec.milling_fee_per_kg || 0).toFixed(3)} TND/kg
            </span>
          </div>
          <div className="p-3 bg-white rounded border border-stone-200">
            <span className="text-[10px] text-stone-500 block">Poids Net Facturé</span>
            <span className="font-mono font-bold text-stone-900 text-sm">{rec.net_weight_kg} KG</span>
          </div>
          <div className="p-3 bg-stone-900 text-white rounded border border-stone-800">
            <span className="text-[10px] text-amber-300 font-bold block uppercase">Total à Payer</span>
            <span className="font-mono font-black text-amber-400 text-base">
              {(rec.total_milling_fee_tnd || 0).toFixed(3)} TND
            </span>
          </div>
        </div>

        <div className="p-3 bg-white rounded border border-stone-200 flex items-center justify-between text-xs font-mono">
          <div>
            <span className="text-stone-500">Montant Déjà Réglé : </span>
            <span className="font-black text-emerald-700">{(rec.paid_amount_tnd || 0).toFixed(3)} TND</span>
          </div>
          <div>
            <span className="text-stone-500">Reste à Régler : </span>
            <span className="font-black text-amber-900">{rem.toFixed(3)} TND</span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-stone-200">
        <div className="grid grid-cols-2 gap-8 text-center text-xs">
          <div className="border border-stone-300 rounded-lg p-4 h-28 flex flex-col justify-between">
            <span className="font-semibold text-stone-700">Signature du Client / Producteur</span>
            <span className="text-[10px] text-stone-400 font-arabic">توقيع الفلاح / الحريف</span>
          </div>
          <div className="border border-stone-300 rounded-lg p-4 h-28 flex flex-col justify-between">
            <span className="font-semibold text-stone-700">Cachet &amp; Signature {settings.company_name}</span>
            <span className="text-[10px] text-stone-400 font-arabic">ختم وتوقيع المعصرة</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. BON DE RÉCEPTION OLIVES — RP80 (80mm)
// ==========================================
function renderOliveReceptionRP80(rec: OliveReception, settings: AppSettings) {
  const recDateStr = rec.date
    ? new Date(rec.date).toLocaleDateString('fr-TN')
    : new Date().toLocaleDateString('fr-TN');
  const rem = Math.max(0, rec.remaining_amount_tnd || 0);

  return (
    <div className="text-center font-mono text-[11px] leading-tight space-y-2 py-2">
      <div>
        <h1 className="text-base font-black tracking-tight uppercase text-black">{settings.company_name}</h1>
        <p className="font-arabic font-bold text-xs" dir="rtl">
          {settings.arabic_subtitle}
        </p>
        <p className="text-[10px] text-stone-600 mt-0.5">Tél: {settings.phone}</p>
        <p className="text-[9px] text-stone-500">{settings.address}</p>
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      <div>
        <span className="font-black text-xs uppercase block tracking-wider">TICKET RÉCEPTION OLIVES</span>
        <span className="font-black text-sm block mt-0.5">{rec.ticket_number}</span>
        <span className="text-[10px] block mt-0.5">Date : {recDateStr}</span>
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      <div className="text-left space-y-0.5 text-[11px]">
        <div className="flex justify-between">
          <span>Client :</span>
          <span className="font-black">{rec.party_name}</span>
        </div>
        {rec.phone && (
          <div className="flex justify-between">
            <span>Tél :</span>
            <span>{rec.phone}</span>
          </div>
        )}
        {rec.vehicle_plate && (
          <div className="flex justify-between">
            <span>Matr :</span>
            <span>{rec.vehicle_plate}</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      <div className="text-left space-y-1">
        <div className="flex justify-between text-[10px]">
          <span>Poids Brut :</span>
          <span>{rec.gross_weight_kg} kg</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span>Tare :</span>
          <span>{rec.tare_weight_kg} kg</span>
        </div>
        <div className="flex justify-between text-xs font-black pt-1 border-t border-dotted border-stone-400">
          <span>POIDS NET :</span>
          <span className="text-sm">{rec.net_weight_kg} KG</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      <div className="text-left space-y-1">
        <div className="flex justify-between text-[10px]">
          <span>Prix trituration :</span>
          <span>{(rec.milling_fee_per_kg || 0).toFixed(3)} TND/kg</span>
        </div>
        <div className="flex justify-between text-xs font-black pt-1 border-t border-dotted border-stone-400">
          <span>TOTAL À PAYER :</span>
          <span className="text-sm">{(rec.total_milling_fee_tnd || 0).toFixed(3)} TND</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span>Déjà réglé :</span>
          <span>{(rec.paid_amount_tnd || 0).toFixed(3)} TND</span>
        </div>
        <div className="flex justify-between text-xs font-black">
          <span>RESTE À PAYER :</span>
          <span>{rem.toFixed(3)} TND</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span>Statut :</span>
          <span className="font-black uppercase">
            {rec.payment_status === 'PAYE' ? 'PAYÉ' : rec.payment_status === 'PARTIEL' ? 'PARTIEL' : 'IMPAYÉ'}
          </span>
        </div>
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      <div className="text-center text-[10px] space-y-1 pt-1">
        <p className="font-bold">Opérateur : {rec.operator || 'Huilerie'}</p>
        <p className="font-bold">Merci de votre confiance !</p>
        <p className="font-arabic font-bold text-xs" dir="rtl">
          مع الشكر لثقتكم بمعصرتنا
        </p>
      </div>
    </div>
  );
}

// ==========================================
// 3. OTHER DOCUMENT TYPES
// ==========================================
function renderStockOperation(op: any, titleFr: string, titleAr: string) {
  return (
    <div className="space-y-6">
      <div className="bg-stone-50 p-4 rounded-lg border border-stone-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-stone-900">{titleFr}</h2>
          <p className="text-xs font-arabic font-bold text-amber-700" dir="rtl">
            {titleAr}
          </p>
        </div>
        <span
          className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded ${
            op.status === 'VALIDE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}
        >
          {op.status === 'VALIDE' ? 'Validé' : 'Annulé'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="p-3 bg-stone-50 rounded border border-stone-200">
          <span className="text-stone-500 block">Producteur / Client:</span>
          <span className="font-bold text-sm text-stone-900">{op.party_name || op.party_id}</span>
        </div>
        <div className="p-3 bg-stone-50 rounded border border-stone-200">
          <span className="text-stone-500 block">Opérateur responsable:</span>
          <span className="font-medium text-stone-800">{op.operator || 'Personnel Huilerie'}</span>
        </div>
      </div>

      <div className="border border-stone-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-100 border-b border-stone-200 text-stone-700">
            <tr>
              <th className="p-3">Cuve Affectée</th>
              <th className="p-3">Mouvement</th>
              <th className="p-3 text-right">Quantité (Litres)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {op.movements && op.movements.length > 0 ? (
              op.movements.map((m: any, idx: number) => (
                <tr key={idx}>
                  <td className="p-3 font-medium">{m.tank_code || m.tank_id}</td>
                  <td className="p-3 text-stone-600">{m.direction === 'IN' ? 'Entrée (+)' : 'Sortie (-)'}</td>
                  <td className="p-3 text-right font-mono font-bold">{m.quantity} L</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-3 font-medium">Cuve assignée</td>
                <td className="p-3 text-stone-600">{op.type === 'ENTREE' ? 'Entrée (+)' : 'Sortie (-)'}</td>
                <td className="p-3 text-right font-mono font-bold">{op.total_quantity} L</td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-stone-50 font-bold border-t border-stone-200">
            <tr>
              <td colSpan={2} className="p-3 text-stone-800">
                Total Général :
              </td>
              <td className="p-3 text-right font-mono text-sm text-amber-900">{op.total_quantity} L</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {op.notes && (
        <div className="p-3 bg-stone-50 rounded border border-stone-200 text-xs">
          <span className="font-semibold text-stone-700 block mb-1">Observations :</span>
          <p className="text-stone-600">{op.notes}</p>
        </div>
      )}
    </div>
  );
}

function renderStockTransfer(op: any) {
  return (
    <div className="space-y-6">
      <div className="bg-stone-50 p-4 rounded-lg border border-stone-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-stone-900">BON DE TRANSFERT INTER-CUVES</h2>
          <p className="text-xs font-arabic font-bold text-amber-700" dir="rtl">
            وصل تحويل داخلي بين الخزانات
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="p-3 bg-stone-50 rounded border border-stone-200">
          <span className="text-stone-500 block">Cuve Source (Origine):</span>
          <span className="font-bold text-sm text-stone-900">{op.source_tank_code || 'Cuve Source'}</span>
        </div>
        <div className="p-3 bg-stone-50 rounded border border-stone-200">
          <span className="text-stone-500 block">Cuve Destination (Réceptrice):</span>
          <span className="font-bold text-sm text-stone-900">{op.target_tank_code || 'Cuve Destination'}</span>
        </div>
      </div>
      <div className="p-4 bg-amber-50 rounded border border-amber-200 text-center">
        <span className="text-xs text-amber-800 uppercase block font-semibold">Volume Transféré</span>
        <span className="font-mono text-2xl font-black text-amber-900">{op.total_quantity} Litres</span>
      </div>
    </div>
  );
}

function renderProductionTicket(batch: ProductionBatch) {
  return (
    <div className="space-y-6">
      <div className="bg-stone-50 p-4 rounded-lg border border-stone-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-stone-900">BON DE TRITURATION &amp; RENDEMENT D&apos;HUILE</h2>
          <p className="text-xs font-arabic font-bold text-amber-700" dir="rtl">
            وصل عصر الزيتون واحتساب المردود
          </p>
        </div>
        <span
          className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded ${
            batch.is_confirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {batch.is_confirmed ? 'CONFIRMÉ & VERROUILLÉ' : 'EN ATTENTE DE CONFIRMATION'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-stone-50 rounded border border-stone-200">
          <span className="text-stone-500 block">Producteur:</span>
          <span className="font-bold text-stone-900">
            {batch.party_name} {batch.party_code ? `(${batch.party_code})` : ''}
          </span>
        </div>
        <div className="p-3 bg-stone-50 rounded border border-stone-200">
          <span className="text-stone-500 block">Bon Réception Olives lié:</span>
          <span className="font-mono font-semibold text-stone-900">{batch.reception_ticket}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="p-3 bg-white rounded border border-stone-200">
          <span className="text-[10px] text-stone-500 block">Olives Net</span>
          <span className="font-mono font-bold text-stone-900 text-sm">{batch.olives_net_kg} KG</span>
        </div>
        <div className="p-3 bg-stone-50 rounded border border-stone-200">
          <span className="text-[10px] text-stone-500 block">Huile Extraite (KG)</span>
          <span className="font-mono font-black text-stone-900 text-base">{batch.oil_quantity_kg} KG</span>
        </div>
        <div className="p-3 bg-amber-50 rounded border border-amber-300">
          <span className="text-[10px] text-amber-800 font-bold block">Équivalent Litres</span>
          <span className="font-mono font-black text-amber-900 text-base">{batch.oil_quantity_litres} L</span>
        </div>
        <div className="p-3 bg-emerald-50 rounded border border-emerald-300">
          <span className="text-[10px] text-emerald-800 font-bold block">Rendement %</span>
          <span className="font-mono font-black text-emerald-900 text-base">
            {batch.yield_percentage.toFixed(2)} %
          </span>
        </div>
      </div>

      <div className="bg-stone-50 p-4 rounded-lg border border-stone-200 text-xs space-y-2">
        <div className="flex justify-between">
          <span className="text-stone-600">Facteur de conversion officiel :</span>
          <span className="font-mono font-bold text-stone-900">1 KG = {OIL_KG_TO_LITRES_FACTOR} L</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-600">Rendement en Litres / 100 KG :</span>
          <span className="font-mono font-bold text-stone-900">
            {batch.yield_litres_per_100kg.toFixed(2)} L / 100 KG
          </span>
        </div>
        <div className="flex justify-between text-stone-600">
          <span>Destination de l&apos;huile :</span>
          <span className="font-semibold text-stone-800">
            {batch.oil_destination === 'SORTIE_CLIENT'
              ? 'Enlèvement par le producteur'
              : batch.oil_destination === 'STOCKAGE_CUVE'
              ? `Mise en Cuve (${batch.destination_tank_id || 'assignée'})`
              : 'En attente de décision client'}
          </span>
        </div>
      </div>
    </div>
  );
}

function renderGrignonSale(sale: GrignonSale) {
  const isKg = sale.price_unit === 'KG';
  return (
    <div className="space-y-6">
      <div className="bg-stone-50 p-4 rounded-lg border border-stone-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-stone-900">BON DE VENTE DES GRIGNONS (فيتورة)</h2>
          <p className="text-xs font-arabic font-bold text-amber-700" dir="rtl">
            وصل بيع ونقل الفيتورة السائبة
          </p>
        </div>
        <span
          className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded ${
            sale.payment_status === 'PAYE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {sale.payment_status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-stone-50 rounded border border-stone-200">
          <span className="text-stone-500 block">Acheteur / Usine:</span>
          <span className="font-bold text-stone-900 text-sm">{sale.buyer_name}</span>
        </div>
        <div className="p-3 bg-stone-50 rounded border border-stone-200">
          <span className="text-stone-500 block">Matricule Camion / Chauffeur:</span>
          <span className="font-bold text-stone-900">
            {sale.truck_plate} {sale.driver_name ? `(${sale.driver_name})` : ''}
          </span>
        </div>
      </div>

      <div className="bg-stone-50 rounded-lg border border-stone-200 p-4">
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="p-2 bg-white rounded border border-stone-200">
            <span className="text-stone-500 block">Poids Brut</span>
            <span className="font-mono font-bold text-stone-800">{sale.gross_weight_kg} KG</span>
          </div>
          <div className="p-2 bg-white rounded border border-stone-200">
            <span className="text-stone-500 block">Tare Camion</span>
            <span className="font-mono font-bold text-stone-600">{sale.tare_weight_kg} KG</span>
          </div>
          <div className="p-2 bg-amber-50 rounded border border-amber-300">
            <span className="text-amber-800 block font-bold">Poids Net Chargé</span>
            <span className="font-mono font-black text-amber-900">
              {sale.net_weight_tonnes} Tonnes ({sale.net_weight_kg} KG)
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 bg-amber-50/60 rounded-lg border border-amber-200 text-xs space-y-2">
        <div className="flex justify-between">
          <span className="text-stone-600">Prix unitaire convenu ({isKg ? 'par KG' : 'par Tonne'}) :</span>
          <span className="font-mono font-bold text-stone-900">
            {isKg
              ? `${(sale.unit_price_tnd || 0).toFixed(3)} TND / KG`
              : `${sale.unit_price_per_tonne_tnd.toFixed(3)} TND / Tonne`}
          </span>
        </div>
        <div className="flex justify-between border-t border-amber-200 pt-2 font-black text-sm text-amber-950">
          <span>Montant Total à Régler :</span>
          <span className="font-mono text-lg">{sale.total_price_tnd.toFixed(3)} TND</span>
        </div>
        <div className="flex justify-between text-stone-600 pt-1">
          <span>Mode de règlement :</span>
          <span className="font-semibold text-stone-800">{sale.payment_mode}</span>
        </div>
      </div>
    </div>
  );
}

function renderClientStatement(clientSummary: any) {
  return (
    <div className="space-y-6">
      <div className="bg-stone-50 p-4 rounded-lg border border-stone-200">
        <h2 className="text-lg font-bold text-stone-900">RELEVÉ DE COMPTE PRODUCTEUR</h2>
        <p className="text-xs font-arabic font-bold text-amber-700" dir="rtl">
          كشف حساب الفلاح - معصرة جماعي
        </p>
        <p className="text-xs text-stone-600 mt-1">
          Client: <strong>{clientSummary.party_name}</strong> (Code: {clientSummary.party_code})
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center text-xs">
        <div className="p-3 bg-white rounded border border-stone-200">
          <span className="text-stone-500 block">Total Olives Apportées</span>
          <span className="font-mono font-bold text-stone-900">{clientSummary.total_olives_kg || 0} KG</span>
        </div>
        <div className="p-3 bg-amber-50 rounded border border-amber-200">
          <span className="text-amber-800 font-bold block">Huile Totale Extraite</span>
          <span className="font-mono font-black text-amber-900">{clientSummary.total_oil_litres || 0} L</span>
        </div>
        <div className="p-3 bg-emerald-50 rounded border border-emerald-200">
          <span className="text-emerald-800 font-bold block">Rendement Moyen</span>
          <span className="font-mono font-black text-emerald-900">
            {clientSummary.average_yield_percent?.toFixed(2) || '0.00'} %
          </span>
        </div>
      </div>
    </div>
  );
}

function renderPurchaseReceipt(purchase: any) {
  return (
    <div className="space-y-6">
      <div className="bg-stone-50 p-4 rounded-lg border border-stone-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-stone-900">BON D&apos;ACHAT DIRECT (COMPTE HUILERIE)</h2>
          <p className="text-xs font-arabic font-bold text-amber-700" dir="rtl">
            وصل شراء لحساب المعصرة
          </p>
        </div>
        <span
          className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded ${
            purchase.payment_status === 'PAYE'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {purchase.payment_status === 'PAYE' ? 'Payé' : 'Impayé'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-stone-50 rounded border border-stone-200">
          <span className="text-stone-500 block">Fournisseur / Agriculteur:</span>
          <span className="font-bold text-stone-900 text-sm">{purchase.supplier_name}</span>
          {purchase.supplier_phone && (
            <span className="text-stone-500 block text-[11px]">{purchase.supplier_phone}</span>
          )}
        </div>
        <div className="p-3 bg-stone-50 rounded border border-stone-200">
          <span className="text-stone-500 block">Nature du Produit Acheté:</span>
          <span className="font-bold text-stone-900">
            {purchase.item_type === 'OLIVES' ? 'Olives en Vrac' : 'Huile d’Olive en Vrac'}
          </span>
        </div>
      </div>

      <div className="bg-stone-50 rounded-lg border border-stone-200 p-4">
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="p-2 bg-white rounded border border-stone-200">
            <span className="text-stone-500 block">Quantité Achetée</span>
            <span className="font-mono font-bold text-stone-900 text-sm">
              {purchase.quantity} {purchase.item_type === 'OLIVES' ? 'KG' : 'L'}
            </span>
          </div>
          <div className="p-2 bg-white rounded border border-stone-200">
            <span className="text-stone-500 block">Prix Unitaire Convenu</span>
            <span className="font-mono font-bold text-stone-800">{purchase.unit_price_tnd?.toFixed(3)} TND</span>
          </div>
          <div className="p-2 bg-amber-50 rounded border border-amber-300">
            <span className="text-amber-800 block font-bold">Montant Total à Payer</span>
            <span className="font-mono font-black text-amber-900 text-sm">
              {purchase.total_price_tnd?.toFixed(3)} TND
            </span>
          </div>
        </div>
      </div>

      <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs flex justify-between items-center">
        <div>
          <span className="text-stone-500">Mode de paiement: </span>
          <span className="font-bold text-stone-800">{purchase.payment_mode}</span>
        </div>
        {purchase.notes && <div className="text-stone-600 italic">Obs: {purchase.notes}</div>}
      </div>
    </div>
  );
}

function renderSalaryAdvance(adv: SalaryAdvance) {
  return (
    <div className="space-y-6">
      <div className="bg-amber-50 p-4 rounded-lg border border-amber-300 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-amber-950">BON D&apos;AVANCE SUR SALAIRE</h2>
          <p className="text-xs font-arabic font-bold text-amber-800" dir="rtl">
            وصل تسبقة على الأجرة
          </p>
        </div>
        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-white border border-amber-300 text-amber-900">
          {adv.doc_number}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="p-3 bg-stone-50 rounded border border-stone-200">
          <span className="text-stone-500 block">Employé / Bénéficiaire :</span>
          <span className="font-bold text-sm text-stone-900">{adv.employee_name}</span>
        </div>
        <div className="p-3 bg-stone-50 rounded border border-stone-200">
          <span className="text-stone-500 block">Date &amp; Heure du Versement :</span>
          <span className="font-mono font-bold text-stone-800">
            {new Date(adv.advance_date || adv.created_at).toLocaleString('fr-FR')}
          </span>
        </div>
      </div>

      <div className="p-5 bg-stone-900 text-white rounded-xl flex items-center justify-between">
        <div>
          <span className="text-xs uppercase font-bold text-amber-300 block">Montant de l&apos;Avance Versée</span>
          <span className="text-[11px] text-stone-300">Mode : {adv.payment_mode} · Opérateur : {adv.operator}</span>
        </div>
        <span className="font-mono text-2xl font-black text-amber-400">
          {Number(adv.amount_tnd).toFixed(3)} TND
        </span>
      </div>

      {adv.notes && (
        <div className="p-3 bg-stone-50 rounded border border-stone-200 text-xs">
          <span className="font-bold text-stone-700 block mb-0.5">Observations :</span>
          <p className="text-stone-600">{adv.notes}</p>
        </div>
      )}
    </div>
  );
}

function renderSalarySettlement(pay: SalaryPayment) {
  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-300 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-emerald-950">BULLETIN &amp; BON DE RÈGLEMENT SALAIRE</h2>
          <p className="text-xs font-arabic font-bold text-emerald-800" dir="rtl">
            وصل خلاص الأجرة الشهرية
          </p>
        </div>
        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-white border border-emerald-300 text-emerald-900">
          {pay.doc_number}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 bg-stone-50 rounded border border-stone-200">
          <span className="text-stone-500 block">Employé :</span>
          <span className="font-bold text-sm text-stone-900">{pay.employee_name}</span>
        </div>
        <div className="p-3 bg-stone-50 rounded border border-stone-200">
          <span className="text-stone-500 block">Période (Mois) :</span>
          <span className="font-mono font-bold text-stone-900">{pay.period_month}</span>
        </div>
        <div className="p-3 bg-stone-50 rounded border border-stone-200">
          <span className="text-stone-500 block">Date de Règlement :</span>
          <span className="font-mono font-bold text-stone-900">
            {new Date(pay.payment_date || pay.created_at).toLocaleDateString('fr-TN')}
          </span>
        </div>
      </div>

      <div className="border border-stone-200 rounded-lg overflow-hidden text-xs">
        <table className="w-full text-left">
          <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
            <tr>
              <th className="p-3">Rubrique</th>
              <th className="p-3 text-right">Montant (TND)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            <tr>
              <td className="p-3 font-medium">Salaire Mensuel de Base</td>
              <td className="p-3 text-right font-mono font-bold">{Number(pay.base_salary_tnd).toFixed(3)} TND</td>
            </tr>
            <tr>
              <td className="p-3 text-amber-800">(-) Total Avances Déduites ({pay.period_month})</td>
              <td className="p-3 text-right font-mono font-bold text-amber-800">
                - {Number(pay.total_advances_tnd).toFixed(3)} TND
              </td>
            </tr>
            {Number(pay.previous_payments_tnd || 0) > 0 && (
              <tr>
                <td className="p-3 text-stone-600">(-) Règlements Antérieurs</td>
                <td className="p-3 text-right font-mono font-bold text-stone-600">
                  - {Number(pay.previous_payments_tnd).toFixed(3)} TND
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-emerald-950 text-white font-black">
            <tr>
              <td className="p-3.5 uppercase">Net Payé (Règlement Définitif · {pay.payment_mode})</td>
              <td className="p-3.5 text-right font-mono text-base text-emerald-300">
                {Number(pay.net_paid_tnd).toFixed(3)} TND
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {pay.notes && (
        <div className="p-3 bg-stone-50 rounded border border-stone-200 text-xs">
          <span className="font-bold text-stone-700 block mb-0.5">Observations :</span>
          <p className="text-stone-600">{pay.notes}</p>
        </div>
      )}
    </div>
  );
}

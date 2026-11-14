/**
 * Export and Print Utilities for Huilerie Jemai
 * Generates XLSX workbooks and handles PDF / Print rendering
 */
import * as XLSX from 'xlsx';
import { TankStockDetail, ClientStockSummary } from '../types/stock';
import {
  OliveReception,
  ProductionBatch,
  GrignonSale,
  PurchaseBatch,
  ExpenseItem,
  Employee,
  SalaryAdvance,
  SalaryPayment,
} from '../types/production';

function fmtDate(val?: string | null): string {
  if (!val) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? val : d.toLocaleDateString('fr-TN');
}

export function exportTanksToExcel(
  tanks: TankStockDetail[],
  companyName: string = 'HUILERIE JEMAI'
) {
  const rows = tanks.map((t) => ({
    'Code Cuve': t.tank.code,
    Désignation: t.tank.name,
    'Capacité (L)': t.tank.capacity,
    'Stock Actuel (L)': t.current_quantity,
    'Remplissage (%)': `${t.fill_percentage}%`,
    'Disponible (L)': t.remaining_capacity,
    Statut: t.is_alert ? 'ALERTE SEUIL DÉPASSÉ' : 'NORMAL',
    'Nombre de Producteurs': t.clients_breakdown.length,
    'Détail Producteurs': t.clients_breakdown
      .map((c) => `${c.party_name} (${c.quantity}L)`)
      .join('; '),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stock_Cuves');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${companyName.replace(/\s+/g, '_')}_Stock_Cuves_${dateStr}.xlsx`);
}

export function exportClientsToExcel(
  clients: ClientStockSummary[],
  companyName: string = 'HUILERIE JEMAI'
) {
  const rows = clients.map((c) => ({
    'Code Client': c.party.code,
    'Nom Client': c.party.name,
    Téléphone: c.party.phone || '-',
    'Huile en Stock (L)': c.total_quantity,
    'Répartition par Cuve': c.tanks_distribution
      .map((td) => `${td.tank_code}: ${td.quantity}L`)
      .join('; '),
    'Total Opérations': c.total_operations,
    'Dernier Mouvement': fmtDate(c.last_operation_date),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stock_Clients');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${companyName.replace(/\s+/g, '_')}_Stock_Clients_${dateStr}.xlsx`);
}

export function exportOliveReceptionsToExcel(
  receptions: OliveReception[],
  companyName: string = 'HUILERIE JEMAI'
) {
  const rows = receptions.map((r) => ({
    'N° Ticket': r.ticket_number,
    Date: fmtDate(r.date),
    'Code Client': r.party_code || '-',
    'Client / Producteur': r.party_name,
    Téléphone: r.phone || '-',
    'Matricule Véhicule': r.vehicle_plate || '-',
    Chauffeur: r.driver_name || '-',
    'Poids Brut (KG)': r.gross_weight_kg,
    'Tare (KG)': r.tare_weight_kg,
    'Poids Net (KG)': r.net_weight_kg,
    'Tarif (TND/KG)': Number(r.milling_fee_per_kg || 0).toFixed(3),
    'Montant Total (TND)': Number(r.total_milling_fee_tnd || 0).toFixed(3),
    'Payé (TND)': Number(r.paid_amount_tnd || 0).toFixed(3),
    'Reste (TND)': Number(r.remaining_amount_tnd || 0).toFixed(3),
    'Statut Paiement': r.payment_status,
    Statut: r.status,
    Opérateur: r.operator,
    Notes: r.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Receptions_Olives');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${companyName.replace(/\s+/g, '_')}_Receptions_Olives_${dateStr}.xlsx`);
}

export function exportProductionToExcel(
  batches: ProductionBatch[],
  companyName: string = 'HUILERIE JEMAI'
) {
  const rows = batches.map((b) => ({
    'N° Bon Trituration': b.ticket_number,
    'N° Réception': b.reception_ticket,
    Producteur: b.party_name,
    'Olives Net (KG)': b.olives_net_kg,
    'Huile Produite (KG)': b.oil_quantity_kg,
    'Volume Huile (L · 1kg=1.1L)': b.oil_quantity_litres,
    'Rendement (%)': `${Number(b.yield_percentage).toFixed(2)}%`,
    'Rendement (L / 100 KG)': Number(b.yield_litres_per_100kg).toFixed(2),
    'Grignons Estimés (KG)': b.grignons_estimated_kg,
    'Destination Huile': b.oil_destination,
    Statut: b.is_confirmed ? 'CONFIRMÉ (VERROUILLÉ)' : 'EN ATTENTE',
    'Confirmé par': b.confirmed_by || '-',
    Opérateur: b.operator,
    Date: fmtDate(b.started_at),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Trituration_Production');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${companyName.replace(/\s+/g, '_')}_Trituration_${dateStr}.xlsx`);
}

export function exportGrignonsToExcel(
  sales: GrignonSale[],
  companyName: string = 'HUILERIE JEMAI'
) {
  const rows = sales.map((s) => ({
    'N° Bon Vente': s.doc_number,
    Date: fmtDate(s.date),
    Acheteur: s.buyer_name,
    'Matricule Camion': s.truck_plate,
    Chauffeur: s.driver_name || '-',
    'Poids Brut (KG)': s.gross_weight_kg,
    'Tare (KG)': s.tare_weight_kg,
    'Poids Net (KG)': s.net_weight_kg,
    'Poids Net (Tonnes)': s.net_weight_tonnes,
    'Unité Prix': s.price_unit === 'KG' ? 'TND / KG' : 'TND / Tonne',
    'Prix Unitaire (TND)': Number(s.unit_price_tnd || s.unit_price_per_tonne_tnd).toFixed(3),
    'Équivalent / Tonne (TND)': Number(s.unit_price_per_tonne_tnd).toFixed(3),
    'Total (TND)': Number(s.total_price_tnd).toFixed(3),
    'Mode Paiement': s.payment_mode,
    Statut: s.payment_status,
    Opérateur: s.operator,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ventes_Grignons');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${companyName.replace(/\s+/g, '_')}_Ventes_Grignons_${dateStr}.xlsx`);
}

export function exportPurchasesToExcel(
  purchases: PurchaseBatch[],
  companyName: string = 'HUILERIE JEMAI'
) {
  const rows = purchases.map((p) => ({
    'N° Bon Achat': p.doc_number,
    Date: fmtDate(p.date),
    Fournisseur: p.supplier_name,
    Téléphone: p.supplier_phone || '-',
    'Type Produit': p.item_type === 'OLIVES' ? 'Olives' : 'Huile en vrac',
    Quantité: p.quantity,
    Unité: p.item_type === 'OLIVES' ? 'KG' : 'L',
    'Prix Unitaire (TND)': Number(p.unit_price_tnd).toFixed(3),
    'Total (TND)': Number(p.total_price_tnd).toFixed(3),
    'Mode Paiement': p.payment_mode,
    Statut: p.payment_status,
    Opérateur: p.operator,
    Notes: p.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Achats_Huilerie');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${companyName.replace(/\s+/g, '_')}_Achats_Huilerie_${dateStr}.xlsx`);
}

export function exportPersonnelToExcel(
  employees: Employee[],
  advances: SalaryAdvance[],
  payments: SalaryPayment[],
  companyName: string = 'HUILERIE JEMAI'
) {
  const empRows = employees.map((e) => ({
    Code: e.code,
    'Nom Complet': e.full_name,
    Poste: e.role_title,
    Téléphone: e.phone || '-',
    'Salaire Base (TND)': Number(e.base_salary_tnd).toFixed(3),
    'Date Embauche': fmtDate(e.hire_date),
    Statut: e.is_active ? 'ACTIF' : 'INACTIF',
  }));

  const advRows = advances.map((a) => ({
    'N° Bon Avance': a.doc_number,
    Date: fmtDate(a.advance_date),
    Mois: a.period_month,
    Employé: a.employee_name,
    'Montant (TND)': Number(a.amount_tnd).toFixed(3),
    Mode: a.payment_mode,
    Statut: a.is_settled ? 'Déduit / Soldé' : 'En cours',
    Opérateur: a.operator,
  }));

  const payRows = payments.map((p) => ({
    'N° Bon Paie': p.doc_number,
    Mois: p.period_month,
    Date: fmtDate(p.payment_date),
    Employé: p.employee_name,
    'Salaire Base (TND)': Number(p.base_salary_tnd).toFixed(3),
    'Avances Déduites (TND)': Number(p.total_advances_tnd).toFixed(3),
    'Net Payé (TND)': Number(p.net_paid_tnd).toFixed(3),
    Mode: p.payment_mode,
    Opérateur: p.operator,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empRows), 'Employes');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(advRows), 'Avances_Salaires');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payRows), 'Reglements_Paie');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${companyName.replace(/\s+/g, '_')}_Personnel_Paie_${dateStr}.xlsx`);
}

export function exportFinancesToExcel(
  millingTotalTnd: number,
  grignonTotalTnd: number,
  purchasesTotalTnd: number,
  expenses: ExpenseItem[],
  companyName: string = 'HUILERIE JEMAI',
  salaryAdvances: SalaryAdvance[] = [],
  salaryPayments: SalaryPayment[] = []
) {
  const expensesTotal = expenses.reduce((a, b) => a + Number(b.amount_tnd || 0), 0);
  const advancesTotal = salaryAdvances.reduce((a, b) => a + Number(b.amount_tnd || 0), 0);
  const netSalariesTotal = salaryPayments.reduce((a, b) => a + Number(b.net_paid_tnd || 0), 0);
  const payrollTotal = advancesTotal + netSalariesTotal;
  const netBalance =
    millingTotalTnd + grignonTotalTnd - purchasesTotalTnd - expensesTotal - payrollTotal;

  const summaryRows = [
    { Poste: 'Recettes Mouture Encaissées (BON-OLV)', 'Montant (TND)': millingTotalTnd.toFixed(3) },
    { Poste: 'Recettes Ventes Grignons (BON-GRI)', 'Montant (TND)': grignonTotalTnd.toFixed(3) },
    { Poste: 'Achats Olives & Huile (BON-ACH)', 'Montant (TND)': (-purchasesTotalTnd).toFixed(3) },
    { Poste: 'Charges d’Exploitation Totales', 'Montant (TND)': (-expensesTotal).toFixed(3) },
    { Poste: 'Avances sur Salaires (BON-ADV)', 'Montant (TND)': (-advancesTotal).toFixed(3) },
    { Poste: 'Soldes Salaires Versés (BON-PAY)', 'Montant (TND)': (-netSalariesTotal).toFixed(3) },
    { Poste: 'SOLDE NET DE CAISSE', 'Montant (TND)': netBalance.toFixed(3) },
  ];

  const expenseRows = expenses.map((e) => ({
    Date: fmtDate(e.date),
    Catégorie: e.category,
    Libellé: e.label,
    Bénéficiaire: e.beneficiary || '-',
    'Mode Règlement': e.payment_mode,
    'Montant (TND)': Number(e.amount_tnd).toFixed(3),
  }));

  const payrollRows = [
    ...salaryAdvances.map((a) => ({
      Type: 'Avance (BON-ADV)',
      'N° Bon': a.doc_number,
      Date: fmtDate(a.advance_date),
      Mois: a.period_month,
      Employé: a.employee_name,
      Mode: a.payment_mode,
      'Sortie Caisse (TND)': Number(a.amount_tnd).toFixed(3),
    })),
    ...salaryPayments.map((p) => ({
      Type: 'Solde Paie (BON-PAY)',
      'N° Bon': p.doc_number,
      Date: fmtDate(p.payment_date),
      Mois: p.period_month,
      Employé: p.employee_name,
      Mode: p.payment_mode,
      'Sortie Caisse (TND)': Number(p.net_paid_tnd).toFixed(3),
    })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Bilan_Financier');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows), 'Detail_Depenses');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payrollRows), 'Masse_Salariale');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${companyName.replace(/\s+/g, '_')}_Finances_Caisse_${dateStr}.xlsx`);
}

import type { DailyClosing, Expense, GoogleSheetSyncLog } from '../types';
import type { ReportMode, SalesReport } from './reports';

type SyncContext = {
  endpointUrl: string;
  report: SalesReport;
  reportMode: ReportMode;
  selectedDate: string;
  syncedBy: string;
};

const reportModeLabels: Record<ReportMode, string> = {
  today: 'Hari Ini',
  date: 'Pilih Tanggal',
  month: 'Bulan Ini',
  all: 'Semua Waktu',
};

export async function syncReportToGoogleSheet({
  endpointUrl,
  report,
  reportMode,
  selectedDate,
  syncedBy,
}: SyncContext): Promise<GoogleSheetSyncLog> {
  if (!endpointUrl.trim()) {
    return createSyncLog({
      message: 'URL Google Sheet belum diatur',
      reportMode,
      selectedDate,
      status: 'error',
      syncedBy,
    });
  }

  try {
    const response = await fetch(endpointUrl.trim(), {
      body: JSON.stringify(buildGoogleSheetPayload(report, reportMode, selectedDate)),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      method: 'POST',
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(text || `HTTP ${response.status}`);
    }

    return createSyncLog({
      message: 'Sync berhasil',
      reportMode,
      selectedDate,
      status: 'success',
      syncedBy,
    });
  } catch (error) {
    return createSyncLog({
      message:
        error instanceof Error ? `Sync gagal: ${error.message}` : 'Sync gagal',
      reportMode,
      selectedDate,
      status: 'error',
      syncedBy,
    });
  }
}

export function buildGoogleSheetPayload(
  report: SalesReport,
  reportMode: ReportMode,
  selectedDate: string,
) {
  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      reportMode: reportModeLabels[reportMode],
      selectedDate: reportMode === 'date' ? selectedDate : null,
      sourceTransactionCount: report.sourceTransactionCount,
      sourceLegacyCount: report.sourceLegacyCount,
    },
    summary: {
      grossSales: report.grossSales,
      totalDiscount: report.totalDiscount,
      netSales: report.netSales,
      totalHpp: report.totalHpp,
      grossProfit: report.grossProfit,
      grossMargin: report.grossMargin,
      totalExpenses: report.totalExpenses,
      netProfit: report.netProfit,
      netMargin: report.netMargin,
      totalTransactions: report.totalTransactions,
      averageTransactionValue: report.averageTransactionValue,
    },
    paymentSummary: report.paymentSummary,
    discountSummary: {
      totalDiscountAmount: report.totalDiscount,
      discountedTransactionCount: report.discountedTransactionCount,
      averageDiscountPerDiscountedTransaction: report.averageDiscount,
    },
    menuSales: report.menuSales,
    bestSellers: report.bestSellers.map((item, index) => ({
      rank: index + 1,
      menu: item.name,
      quantity: item.quantity,
      netSales: item.netSales,
    })),
    expenseSummary: report.expenseSummary,
    expenseList: report.expenses.map(toExpensePayload),
    dailyClosing: report.dailyClosing
      ? toDailyClosingPayload(report.dailyClosing)
      : null,
  };
}

function toExpensePayload(expense: Expense) {
  return {
    date: expense.date,
    name: expense.name,
    category: expense.category,
    amount: expense.amount,
    paymentMethod: expense.paymentMethod,
    notes: expense.notes,
  };
}

function toDailyClosingPayload(closing: DailyClosing) {
  return {
    date: closing.closingDate,
    expectedCash: closing.expectedCash,
    actualCash: closing.actualCash,
    cashDifference: closing.cashDifference,
    notes: closing.notes,
  };
}

function createSyncLog({
  message,
  reportMode,
  selectedDate,
  status,
  syncedBy,
}: {
  message: string;
  reportMode: ReportMode;
  selectedDate: string;
  status: 'success' | 'error';
  syncedBy: string;
}): GoogleSheetSyncLog {
  return {
    id: `sheet-sync-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    message,
    reportMode,
    selectedDate: reportMode === 'date' ? selectedDate : null,
    status,
    syncedAt: new Date().toISOString(),
    syncedBy,
  };
}

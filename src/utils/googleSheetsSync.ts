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

const reportModeSlugs: Record<ReportMode, string> = {
  today: 'hari-ini',
  date: 'pilih-tanggal',
  month: 'bulan-ini',
  all: 'semua-waktu',
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
      body: JSON.stringify(
        buildGoogleSheetPayload(report, reportMode, selectedDate, syncedBy),
      ),
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
  syncedBy = 'Santara User',
) {
  const generatedAt = new Date().toISOString();
  const reportKey = getReportKey(reportMode, selectedDate);
  const periodValue = getPeriodValue(reportMode, selectedDate);
  const periodLabel = getPeriodLabel(reportMode, selectedDate);
  const monthKey = getMonthKey(reportMode, selectedDate);
  const monthLabel = monthKey ? formatMonthLabel(monthKey) : null;
  const cashSales =
    report.paymentSummary.find((summary) => summary.method === 'Cash')?.total ?? 0;
  const qrisSales =
    report.paymentSummary.find((summary) => summary.method === 'QRIS')?.total ?? 0;
  const debitSales =
    report.paymentSummary.find((summary) => summary.method === 'Debit')?.total ?? 0;

  return {
    metadata: {
      generatedAt,
      reportKey,
      reportMode: reportModeLabels[reportMode],
      reportModeSlug: reportModeSlugs[reportMode],
      periodValue,
      periodLabel,
      monthKey,
      monthLabel,
      selectedDate: reportMode === 'date' ? selectedDate : null,
      syncedBy,
      sourceTransactionCount: report.sourceTransactionCount,
      sourceLegacyCount: report.sourceLegacyCount,
    },
    summary: {
      reportKey,
      periodValue,
      periodLabel,
      monthKey,
      monthLabel,
      grossSales: report.grossSales,
      totalDiscount: report.totalDiscount,
      netSales: report.netSales,
      totalHpp: report.totalHpp,
      grossProfit: report.grossProfit,
      grossMargin: report.grossMargin,
      totalExpenses: report.totalExpenses,
      netProfit: report.netProfit,
      netMargin: report.netMargin,
      cashSales,
      qrisSales,
      debitSales,
      totalTransactions: report.totalTransactions,
      averageTransactionValue: report.averageTransactionValue,
      sourceTransactionCount: report.sourceTransactionCount,
    },
    paymentSummary: report.paymentSummary,
    discountSummary: {
      totalDiscountAmount: report.totalDiscount,
      discountedTransactionCount: report.discountedTransactionCount,
      averageDiscountPerDiscountedTransaction: report.averageDiscount,
    },
    menuSales: report.menuSales.map(toGoogleSheetMenuSalePayload),
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

function toGoogleSheetMenuSalePayload(item: SalesReport['menuSales'][number]) {
  const quantity = safeNumber(item.quantity);
  const grossSales = safeNumber(item.grossSales);
  const discountAmount = safeNumber(item.discountAmount);
  const netSales = safeNumber(item.netSales);
  const totalHpp = safeNumber(item.totalHpp || item.hpp);
  const profit = netSales - totalHpp;
  const unitPrice = quantity > 0 ? grossSales / quantity : 0;
  const unitHpp =
    item.unitHpp > 0
      ? safeNumber(item.unitHpp)
      : quantity > 0
        ? totalHpp / quantity
        : 0;
  const margin = netSales > 0 ? profit / netSales : 0;

  return {
    ...item,
    discountAmount,
    estimatedProfit: profit,
    grossSales,
    hpp: totalHpp,
    margin,
    marginPercent: margin * 100,
    netSales,
    profit,
    quantity,
    totalHpp,
    unitHpp,
    unitPrice,
  };
}

function safeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function getReportKey(reportMode: ReportMode, selectedDate: string) {
  if (reportMode === 'all') {
    return reportModeSlugs.all;
  }

  if (reportMode === 'month') {
    return `${reportModeSlugs.month}-${getCurrentMonthValue()}`;
  }

  if (reportMode === 'date') {
    return `${reportModeSlugs.date}-${selectedDate || getTodayInputValue()}`;
  }

  return `${reportModeSlugs.today}-${getTodayInputValue()}`;
}

function getPeriodValue(reportMode: ReportMode, selectedDate: string) {
  if (reportMode === 'all') {
    return 'semua-waktu';
  }

  if (reportMode === 'month') {
    return getCurrentMonthValue();
  }

  if (reportMode === 'date') {
    return selectedDate || getTodayInputValue();
  }

  return getTodayInputValue();
}

function getPeriodLabel(reportMode: ReportMode, selectedDate: string) {
  if (reportMode === 'all') {
    return 'Periode: Semua Waktu';
  }

  if (reportMode === 'month') {
    return `Periode: ${formatMonthLabel(getCurrentMonthValue())}`;
  }

  const dateValue =
    reportMode === 'date' ? selectedDate || getTodayInputValue() : getTodayInputValue();

  return `Tanggal: ${formatDateLabel(dateValue)}`;
}

function getMonthKey(reportMode: ReportMode, selectedDate: string) {
  if (reportMode === 'all') {
    return null;
  }

  const periodValue = getPeriodValue(reportMode, selectedDate);

  return periodValue.slice(0, 7);
}

function getCurrentMonthValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

function getTodayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);

  if (!year || !month || !day) {
    return dateValue;
  }

  return `${day} ${getIndonesianMonthName(month)} ${year}`;
}

function formatMonthLabel(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number);

  if (!year || !month) {
    return monthValue;
  }

  return `${getIndonesianMonthName(month)} ${year}`;
}

function getIndonesianMonthName(month: number) {
  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];

  return monthNames[month - 1] ?? String(month);
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
    closingDate: closing.closingDate,
    date: closing.closingDate,
    expectedCash: closing.expectedCash,
    actualCash: closing.actualCash,
    cashDifference: closing.cashDifference,
    notes: closing.notes,
    updatedAt: closing.updatedAt,
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

import type { ReportMode, SalesReport } from './reports';

type ExportContext = {
  report: SalesReport;
  reportMode: ReportMode;
  selectedDate: string;
};

type CsvValue = string | number | null | undefined;

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

export function exportReportCsv(context: ExportContext) {
  const metadata = getReportMetadata(context);
  const rows: CsvValue[][] = [
    ['Report Metadata'],
    ['Report mode', metadata.reportMode],
    ...(metadata.selectedDate ? [['Selected date', metadata.selectedDate]] : []),
    ['Generated at', metadata.generatedAt],
    ['Includes legacy import', context.report.hasLegacyData ? 'Yes' : 'No'],
    [],
    ['Summary'],
    ['Metric', 'Value'],
    ['Gross Sales / Penjualan Kotor', context.report.grossSales],
    ['Total Diskon', context.report.totalDiscount],
    ['Net Sales / Penjualan Bersih', context.report.netSales],
    ['Total HPP', context.report.totalHpp],
    ['Gross Profit / Laba Kotor', context.report.grossProfit],
    ['Gross Margin', formatPercentValue(context.report.grossMargin)],
    ['Total Transaksi', context.report.totalTransactions],
    ['Average Transaction Value', context.report.averageTransactionValue],
    ['POS transaction count', context.report.sourceTransactionCount],
    ['Legacy import row count', context.report.sourceLegacyCount],
    [],
    ['Payment Summary'],
    ['Payment Method', 'Transaction Count', 'Total'],
    ...context.report.paymentSummary.map((summary) => [
      summary.method,
      summary.transactionCount,
      summary.total,
    ]),
    [],
    ['Discount Summary'],
    ['Metric', 'Value'],
    ['Total discount amount', context.report.totalDiscount],
    [
      'Number of discounted transactions',
      context.report.discountedTransactionCount,
    ],
    [
      'Average discount per discounted transaction',
      context.report.averageDiscount,
    ],
    [],
    ['Menu Sales'],
    [
      'Menu',
      'Kategori',
      'Qty',
      'Gross Sales',
      'Diskon',
      'Net Sales',
      'HPP',
      'Profit',
      'Margin',
    ],
    ...context.report.menuSales.map((item) => [
      item.name,
      item.category,
      item.quantity,
      item.grossSales,
      item.discountAmount,
      item.netSales,
      item.hpp,
      item.estimatedProfit,
      formatPercentValue(item.margin),
    ]),
    [],
    ['Best Sellers'],
    ['Rank', 'Menu', 'Qty', 'Net Sales'],
    ...context.report.bestSellers.map((item, index) => [
      index + 1,
      item.name,
      item.quantity,
      item.netSales,
    ]),
  ];

  downloadTextFile(
    getReportFileName(context, 'csv'),
    toCsv(rows),
    'text/csv;charset=utf-8',
  );
}

export function exportReportJson(context: ExportContext) {
  const payload = {
    metadata: getReportMetadata(context),
    summary: {
      grossSales: context.report.grossSales,
      totalDiscount: context.report.totalDiscount,
      netSales: context.report.netSales,
      totalHpp: context.report.totalHpp,
      grossProfit: context.report.grossProfit,
      grossMargin: context.report.grossMargin,
      totalTransactions: context.report.totalTransactions,
      averageTransactionValue: context.report.averageTransactionValue,
    },
    paymentSummary: context.report.paymentSummary,
    discountSummary: {
      totalDiscountAmount: context.report.totalDiscount,
      discountedTransactionCount: context.report.discountedTransactionCount,
      averageDiscountPerDiscountedTransaction: context.report.averageDiscount,
    },
    menuSales: context.report.menuSales,
    bestSellers: context.report.bestSellers.map((item, index) => ({
      rank: index + 1,
      menu: item.name,
      quantity: item.quantity,
      netSales: item.netSales,
    })),
    sourceTransactionCount: context.report.sourceTransactionCount,
    sourceLegacyCount: context.report.sourceLegacyCount,
    includesLegacyImport: context.report.hasLegacyData,
  };

  downloadTextFile(
    getReportFileName(context, 'json'),
    JSON.stringify(payload, null, 2),
    'application/json;charset=utf-8',
  );
}

export function downloadTextFile(
  fileName: string,
  content: string,
  mimeType: string,
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: CsvValue[][]) {
  return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\r\n');
}

function getReportMetadata(context: ExportContext) {
  return {
    reportMode: reportModeLabels[context.reportMode],
    selectedDate: context.reportMode === 'date' ? context.selectedDate : null,
    generatedAt: new Date().toISOString(),
  };
}

function getReportFileName(context: ExportContext, extension: 'csv' | 'json') {
  const datePart =
    context.reportMode === 'month'
      ? getCurrentMonthValue()
      : context.reportMode === 'date'
        ? context.selectedDate
        : getTodayValue();

  return `santara-report-${reportModeSlugs[context.reportMode]}-${datePart}.${extension}`;
}

function getTodayValue() {
  return toDateValue(new Date());
}

function getCurrentMonthValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function escapeCsvValue(value: CsvValue) {
  const text = value === null || value === undefined ? '' : String(value);

  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function formatPercentValue(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(2) : '0.00'}%`;
}

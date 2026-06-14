import type { LegacyImportBatch, LegacySale } from '../types';

export type LegacyImportPreviewRow = {
  rowNumber: number;
  saleDate: string;
  menuName: string;
  category: string;
  quantity: number;
  grossSales: number;
  discountAmount: number;
  netSales: number;
  hppTotal: number;
  paymentMethod: string;
  notes: string;
  warnings: string[];
  isValid: boolean;
};

export type LegacyImportPreview = {
  fileName: string;
  rows: LegacyImportPreviewRow[];
  warnings: string[];
  totalRows: number;
  validRows: number;
  totalGrossSales: number;
  totalDiscount: number;
  totalNetSales: number;
  totalHpp: number;
  dateStart: string;
  dateEnd: string;
};

type ColumnKey =
  | 'date'
  | 'menu'
  | 'category'
  | 'quantity'
  | 'grossSales'
  | 'discount'
  | 'netSales'
  | 'hpp'
  | 'paymentMethod'
  | 'notes';

const columnAliases: Record<ColumnKey, string[]> = {
  date: ['date', 'tanggal', 'sale date', 'transaction date', 'tgl'],
  menu: ['menu', 'nama menu', 'menu name', 'item', 'product', 'produk'],
  category: ['category', 'kategori', 'cat'],
  quantity: ['qty', 'jumlah', 'quantity', 'quantity sold', 'sold', 'item sold'],
  grossSales: [
    'gross sales',
    'penjualan kotor',
    'gross',
    'subtotal',
    'total sebelum diskon',
  ],
  discount: ['discount', 'diskon', 'discount amount', 'total diskon'],
  netSales: [
    'net sales',
    'penjualan bersih',
    'net',
    'total',
    'total after discount',
  ],
  hpp: ['hpp', 'cogs', 'cost', 'harga pokok', 'total hpp'],
  paymentMethod: [
    'payment method',
    'metode pembayaran',
    'payment',
    'metode',
    'bayar',
  ],
  notes: ['notes', 'catatan', 'note', 'keterangan'],
};

export function parseLegacySalesCsv(
  csvText: string,
  fileName: string,
): LegacyImportPreview {
  const rows = parseCsv(csvText);
  const [headers = [], ...bodyRows] = rows;
  const columnIndexes = detectColumns(headers);
  const previewRows = bodyRows
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row, index) => mapCsvRow(row, index + 2, columnIndexes));
  const validRows = previewRows.filter((row) => row.isValid);
  const sortedDates = validRows
    .map((row) => row.saleDate)
    .filter(Boolean)
    .sort();

  return {
    fileName,
    rows: previewRows,
    warnings: buildPreviewWarnings(columnIndexes, previewRows),
    totalRows: previewRows.length,
    validRows: validRows.length,
    totalGrossSales: sumRows(validRows, 'grossSales'),
    totalDiscount: sumRows(validRows, 'discountAmount'),
    totalNetSales: sumRows(validRows, 'netSales'),
    totalHpp: sumRows(validRows, 'hppTotal'),
    dateStart: sortedDates[0] ?? '',
    dateEnd: sortedDates[sortedDates.length - 1] ?? '',
  };
}

export function createLegacyImportPayload(
  preview: LegacyImportPreview,
  importedBy: string,
) {
  const importedAt = new Date().toISOString();
  const batchId = `legacy-batch-${Date.now()}`;
  const validRows = preview.rows.filter((row) => row.isValid);
  const batch: LegacyImportBatch = {
    id: batchId,
    fileName: preview.fileName,
    importedAt,
    importedBy,
    totalRows: validRows.length,
    dateStart: preview.dateStart,
    dateEnd: preview.dateEnd,
    totalGrossSales: preview.totalGrossSales,
    totalDiscount: preview.totalDiscount,
    totalNetSales: preview.totalNetSales,
    totalHpp: preview.totalHpp,
  };
  const sales: LegacySale[] = validRows.map((row, index) => ({
    id: `${batchId}-row-${index + 1}`,
    batchId,
    saleDate: row.saleDate,
    menuName: row.menuName,
    category: row.category,
    quantity: row.quantity,
    grossSales: row.grossSales,
    discountAmount: row.discountAmount,
    netSales: row.netSales,
    hppTotal: row.hppTotal,
    paymentMethod: row.paymentMethod || 'Legacy',
    notes: row.notes,
    source: 'legacy_import',
    importedAt,
    importedBy,
  }));

  return { batch, sales };
}

function mapCsvRow(
  row: string[],
  rowNumber: number,
  columnIndexes: Partial<Record<ColumnKey, number>>,
): LegacyImportPreviewRow {
  const warnings: string[] = [];
  const rawDate = getCell(row, columnIndexes.date);
  const saleDate = parseDateValue(rawDate);
  const menuName = getCell(row, columnIndexes.menu);
  const category = getCell(row, columnIndexes.category) || 'Legacy';
  const quantity = parseNumber(getCell(row, columnIndexes.quantity), 1);
  const discountAmount = parseNumber(getCell(row, columnIndexes.discount), 0);
  const rawGrossSales = getCell(row, columnIndexes.grossSales);
  const rawNetSales = getCell(row, columnIndexes.netSales);
  const parsedGrossSales = parseNumber(rawGrossSales, Number.NaN);
  const parsedNetSales = parseNumber(rawNetSales, Number.NaN);
  const grossSales = Number.isFinite(parsedGrossSales)
    ? parsedGrossSales
    : Number.isFinite(parsedNetSales)
      ? parsedNetSales + discountAmount
      : 0;
  const netSales = Number.isFinite(parsedNetSales)
    ? parsedNetSales
    : Math.max(grossSales - discountAmount, 0);
  const hppTotal = parseNumber(getCell(row, columnIndexes.hpp), 0);
  const paymentMethod = getCell(row, columnIndexes.paymentMethod) || 'Legacy';
  const notes = getCell(row, columnIndexes.notes);

  if (!saleDate) {
    warnings.push('Tanggal kosong atau tidak valid');
  }

  if (!menuName) {
    warnings.push('Nama menu kosong');
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    warnings.push('Qty tidak valid');
  }

  if (!rawGrossSales && !rawNetSales) {
    warnings.push('Gross sales / net sales kosong');
  }

  return {
    rowNumber,
    saleDate,
    menuName,
    category,
    quantity: Math.max(1, Math.floor(quantity || 1)),
    grossSales: Math.max(grossSales, 0),
    discountAmount: Math.max(discountAmount, 0),
    netSales: Math.max(netSales, 0),
    hppTotal: Math.max(hppTotal, 0),
    paymentMethod,
    notes,
    warnings,
    isValid: warnings.length === 0,
  };
}

function detectColumns(headers: string[]) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const result: Partial<Record<ColumnKey, number>> = {};

  (Object.keys(columnAliases) as ColumnKey[]).forEach((key) => {
    const index = normalizedHeaders.findIndex((header) =>
      columnAliases[key].some((alias) => header === normalizeHeader(alias)),
    );

    if (index >= 0) {
      result[key] = index;
    }
  });

  return result;
}

function buildPreviewWarnings(
  columnIndexes: Partial<Record<ColumnKey, number>>,
  rows: LegacyImportPreviewRow[],
) {
  const warnings: string[] = [];

  if (columnIndexes.date === undefined) {
    warnings.push('Kolom tanggal tidak terdeteksi.');
  }

  if (columnIndexes.menu === undefined) {
    warnings.push('Kolom menu tidak terdeteksi.');
  }

  if (
    columnIndexes.grossSales === undefined &&
    columnIndexes.netSales === undefined
  ) {
    warnings.push('Kolom penjualan kotor atau penjualan bersih tidak terdeteksi.');
  }

  const invalidCount = rows.filter((row) => !row.isValid).length;

  if (invalidCount > 0) {
    warnings.push(`${invalidCount} baris memiliki data kosong atau tidak valid.`);
  }

  return warnings;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((parsedRow) => parsedRow.some((value) => value.trim()));
}

function parseDateValue(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return '';
  }

  const isoMatch = trimmedValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(
      2,
      '0',
    )}`;
  }

  const slashMatch = trimmedValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);

  if (slashMatch) {
    const year =
      slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];

    return `${year}-${slashMatch[2].padStart(2, '0')}-${slashMatch[1].padStart(
      2,
      '0',
    )}`;
  }

  const parsedDate = new Date(trimmedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  return toInputDate(parsedDate);
}

function parseNumber(value: string, fallback: number) {
  const text = value.replace(/rp/gi, '').replace(/\s/g, '');
  const hasComma = text.includes(',');
  const hasDot = text.includes('.');
  const cleanedValue =
    hasComma && hasDot
      ? text.lastIndexOf(',') > text.lastIndexOf('.')
        ? text.replace(/\./g, '').replace(/,/g, '.')
        : text.replace(/,/g, '')
      : hasComma
        ? /\d+,\d{3}$/.test(text)
          ? text.replace(/,/g, '')
          : text.replace(/,/g, '.')
        : text.replace(/\./g, '');
  const parsedValue = Number(cleanedValue);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function getCell(row: string[], index: number | undefined) {
  return index === undefined ? '' : (row[index] ?? '').trim();
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function sumRows(
  rows: LegacyImportPreviewRow[],
  key: 'grossSales' | 'discountAmount' | 'netSales' | 'hppTotal',
) {
  return rows.reduce((total, row) => total + row[key], 0);
}

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

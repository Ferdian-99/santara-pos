# Google Sheets Sync - Santara POS

Santara POS syncs reports to Google Sheets through a simple Google Apps Script
Web App URL.

This is intentionally simple:

* No Google OAuth inside Santara POS.
* No Google API client inside Santara POS.
* The app sends the selected report to your Apps Script endpoint.
* Apps Script writes readable Santara report sheets into Google Sheets.

## 1. Create the Google Sheet

1. Open Google Sheets.
2. Create a new spreadsheet.
3. Rename it, for example: `Santara POS Reports`.
4. Copy the spreadsheet ID from the URL.

Example URL:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
```

## 2. Create Apps Script

1. In the Google Sheet, open Extensions.
2. Click Apps Script.
3. Delete the starter code.
4. Paste the script below.
5. Replace `SPREADSHEET_ID_HERE` with your spreadsheet ID.
6. Save the script.

This script creates these visible sheets:

* `Laporan Penjualan`
* `Rekap Bulanan`
* `Rekap Keseluruhan`
* `Rekap Produk Bulanan`
* `Sync Logs`

It also creates hidden internal sheets:

* `_Data Rekap Internal`
* `_Data Produk Internal`

Those hidden sheets store the source data for the recap sheets:

* `_Data Rekap Internal`: one row per `Report Key`.
* `_Data Produk Internal`: product rows for the latest sync of each `Report Key`.

Every successful sync updates those internal rows first, then rebuilds
`Rekap Bulanan`, `Rekap Produk Bulanan`, and `Rekap Keseluruhan`. Syncing the
same date again replaces old internal data instead of double counting.

Recap calculations use raw numeric internal values from the POS payload only.
They do not calculate totals from formatted visible cells such as `Rp 80.000`.
The internal sheets store money and counts as raw numbers. Margins and average
transaction value are recalculated during recap rebuilds.

Visible month labels are always rebuilt from a stable `YYYY-MM` month key and
shown with Indonesian month names such as `Juni 2026`.

For each menu row, Santara POS sends explicit HPP/profit fields: `unitHpp`,
`totalHpp`, `hpp`, `estimatedProfit`, `profit`, `margin`, and `marginPercent`.
`unitHpp` means HPP per item. `totalHpp` and `hpp` mean total HPP for the sold
quantity. `margin` is a ratio such as `0.7835`, while `marginPercent` is a
display number such as `78.35`.

If you have tested older script versions and the recap sheets already look
broken, run the optional `resetSantaraReportData()` function once from Apps
Script after replacing the script. It clears internal/recap/log sheets but does
not delete `Laporan Penjualan`. A fresh Google Sheet also works.

Quantity columns such as `Jumlah Terjual` are formatted as normal numbers, not
Rupiah. Currency formatting is only used for money columns, and margin columns
use percent formatting. To test HPP correctly, create a fresh transaction after
setting menu HPP; older transactions created before HPP was set can still show
HPP 0 because reports use transaction snapshots.

```js
const SPREADSHEET_ID = 'SPREADSHEET_ID_HERE';
const REPORT_SHEET_NAME = 'Laporan Penjualan';
const MONTHLY_SHEET_NAME = 'Rekap Bulanan';
const ALL_TIME_SHEET_NAME = 'Rekap Keseluruhan';
const PRODUCT_MONTHLY_SHEET_NAME = 'Rekap Produk Bulanan';
const SYNC_LOG_SHEET_NAME = 'Sync Logs';
const RAW_SUMMARY_SHEET_NAME = '_Data Rekap Internal';
const RAW_PRODUCT_SHEET_NAME = '_Data Produk Internal';
const START_MARKER = '__SANTARA_REPORT_START__';
const END_MARKER = '__SANTARA_REPORT_END__';

// Premium Minimalist Palette & Typography Theme
const COLOR_PRIMARY = '#1E293B';     
const COLOR_TEXT_LIGHT = '#FFFFFF';  
const COLOR_SECONDARY = '#F1F5F9';   
const COLOR_TEXT_DARK = '#0F172A';   
const COLOR_MUTED_TEXT = '#64748B';  
const COLOR_TOTAL_BG = '#FCE7F3';    
const COLOR_BORDER = '#E2E8F0';      
const COLOR_ZEBRA_ODD = '#FFFFFF';   
const COLOR_ZEBRA_EVEN = '#F8FAFC';  
const FONT_FAMILY = 'Roboto';        

const PRODUCT_HEADERS = [
  'No', 'Nama Produk', 'Harga Satuan', 'Jumlah Terjual', 'Pendapatan Kotor',
  'Diskon', 'Pendapatan Bersih', 'HPP', 'Laba Kotor', 'Margin'
];

const MONTHLY_HEADERS = [
  'Bulan', 'Penjualan Kotor', 'Total Diskon', 'Penjualan Bersih', 'Total HPP',
  'Laba Kotor', 'Gross Margin', 'Total Pengeluaran', 'Laba Bersih', 'Net Margin',
  'Cash Sales', 'QRIS Sales', 'Debit Sales', 'Total Transaksi', 'Avg Transaction Value', 'Last Sync'
];

const PRODUCT_MONTHLY_HEADERS = [
  'Bulan', 'Nama Produk', 'Kategori', 'Jumlah Terjual', 'Penjualan Kotor',
  'Diskon', 'Penjualan Bersih', 'HPP', 'Laba Kotor', 'Margin'
];

const ALL_TIME_HEADERS = ['Metric', 'Value'];

const SYNC_LOG_HEADERS = [
  'Synced At', 'Report Key', 'Month Key', 'Menu Rows Processed',
  'Internal Summary Rows', 'Internal Product Rows', 'Report Mode', 'Status', 'Message'
];

const RAW_SUMMARY_HEADERS = [
  'Report Key', 'Month Key', 'Month Label', 'Period Label', 'Generated At',
  'Penjualan Kotor', 'Total Diskon', 'Penjualan Bersih', 'Total HPP', 'Laba Kotor',
  'Total Pengeluaran', 'Laba Bersih', 'Cash Sales', 'QRIS Sales', 'Debit Sales',
  'Total Transaksi', 'Source Transaction Count'
];

const RAW_PRODUCT_HEADERS = [
  'Report Key', 'Month Key', 'Month Label', 'Period Label', 'Nama Produk',
  'Kategori', 'Jumlah Terjual', 'Penjualan Kotor', 'Diskon', 'Penjualan Bersih', 'HPP', 'Laba Kotor'
];

function doPost(e) {
  const syncedAt = new Date();
  let reportKey = 'unknown';
  let reportMode = 'Unknown';
  let monthKey = '';

  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Normalisasi payload sekaligus handle perbaikan HPP
    const normalized = normalizePayload(payload);
    
    const rawSummarySheet = setupRawSheet(spreadsheet, RAW_SUMMARY_SHEET_NAME, RAW_SUMMARY_HEADERS);
    const rawProductSheet = setupRawSheet(spreadsheet, RAW_PRODUCT_SHEET_NAME, RAW_PRODUCT_HEADERS);
    const reportSheet = setupReportSheet(spreadsheet);
    const monthlySheet = setupTableSheet(spreadsheet, MONTHLY_SHEET_NAME, MONTHLY_HEADERS);
    const productMonthlySheet = setupTableSheet(spreadsheet, PRODUCT_MONTHLY_SHEET_NAME, PRODUCT_MONTHLY_HEADERS);
    const allTimeSheet = setupTableSheet(spreadsheet, ALL_TIME_SHEET_NAME, ALL_TIME_HEADERS);
    const syncLogSheet = setupSyncLogSheet(spreadsheet);

    reportKey = normalized.reportKey;
    reportMode = normalized.reportMode;
    monthKey = normalized.monthKey;

    // Tulis blok laporan utama
    replaceReportBlock(reportSheet, reportKey, payload, normalized);
    
    // Tulis rekap internal
    upsertRawSummary(rawSummarySheet, normalized);
    replaceRawProducts(rawProductSheet, normalized, payload.menuSales || []);
    SpreadsheetApp.flush();

    // Rebuild semua rekap
    rebuildMonthlySummary(monthlySheet, rawSummarySheet);
    rebuildProductMonthlySummary(productMonthlySheet, rawProductSheet);
    rebuildAllTimeSummary(allTimeSheet, rawSummarySheet);
    
    appendSyncLog(
      syncLogSheet, syncedAt, reportKey, monthKey, (payload.menuSales || []).length,
      Math.max(rawSummarySheet.getLastRow() - 1, 0), Math.max(rawProductSheet.getLastRow() - 1, 0),
      reportMode, 'success', `Sync berhasil: ${(payload.menuSales || []).length} baris menu diproses`
    );

    return jsonResponse({ ok: true, message: 'Data berhasil disinkronisasi ke semua sheet Google Sheets.' });
  } catch (error) {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const syncLogSheet = setupSyncLogSheet(spreadsheet);
    const message = String(error);
    appendSyncLog(syncLogSheet, syncedAt, reportKey, monthKey, 0, 0, 0, reportMode, 'error', message);
    return jsonResponse({ ok: false, message });
  }
}

// FUNGSI MAPPING HPP SUPER LENGKAP
function parseMenuItem(item) {
  const name = item.name || item.menuName || item.productName || '';
  const category = item.category || item.kategori || '';
  const unitPrice = num(item.unitPrice || item.price || item.hargaSatuan);
  const quantity = num(item.quantity || item.qty || item.jumlahTerjual);
  const grossSales = num(item.grossSales || item.gross || item.penjualanKotor);
  const discountAmount = num(item.discountAmount || item.discount || item.diskon);
  const netSales = num(item.netSales || item.net || item.penjualanBersih);

  const explicitTotalHpp = firstNumberValue(item.totalHpp, item.hppTotal, item.totalCogs, item.cogs);
  const unitHppHint = firstNumberValue(item.unitHpp, item.hppSnapshot, item.hppPerItem, item.costPerItem, item.cost);
  let totalHpp = 0;

  if (explicitTotalHpp !== null) {
    totalHpp = explicitTotalHpp;
  } else if (hasValue(item.hpp)) {
    const hppValue = num(item.hpp);
    const hppLooksLikeUnit = unitHppHint !== null && quantity > 1 && Math.abs(hppValue - unitHppHint) < 0.01;
    totalHpp = hppLooksLikeUnit ? unitHppHint * quantity : hppValue;
  } else if (unitHppHint !== null) {
    totalHpp = unitHppHint * quantity;
  }

  totalHpp = Number.isFinite(totalHpp) ? Math.max(totalHpp, 0) : 0;
  const unitHpp = quantity > 0 ? totalHpp / quantity : 0;
  const estimatedProfit = netSales - totalHpp;
  let margin = safeDivide(estimatedProfit, netSales);

  if (!Number.isFinite(margin)) {
    margin = 0;
  }

  return {
    name,
    category,
    unitPrice,
    quantity,
    grossSales,
    discountAmount,
    netSales,
    unitHpp,
    totalHpp,
    hpp: totalHpp,
    estimatedProfit,
    profit: estimatedProfit,
    margin,
    marginPercent: margin * 100
  };
}
function normalizePayload(payload) {
  const metadata = payload.metadata || {};
  const summary = payload.summary || {};
  const generatedAt = firstValue(metadata.generatedAt, new Date());
  const reportKey = firstValue(metadata.reportKey, summary.reportKey, buildFallbackReportKey(metadata));
  const reportMode = firstValue(metadata.reportMode, 'Unknown');
  const monthKey = deriveMonthKey(metadata, summary, reportKey, generatedAt);
  const monthLabel = getMonthLabel(monthKey);
  const periodLabel = firstValue(metadata.periodLabel, summary.periodLabel, metadata.selectedDate, summary.periodValue, 'Periode laporan');
  
  // Re-kalkulasi back-up HPP dari level menuSales 
  let calculatedTotalHpp = 0;
  if (payload.menuSales && Array.isArray(payload.menuSales)) {
    payload.menuSales.forEach(item => {
      calculatedTotalHpp += parseMenuItem(item).hpp;
    });
  }

  const grossSales = num(summary.grossSales);
  const totalDiscount = num(summary.totalDiscount);
  const netSales = num(summary.netSales);
  
  let totalHpp = num(summary.totalHpp || summary.hppTotal || summary.cogs || summary.totalCogs);
  if (totalHpp === 0 && calculatedTotalHpp > 0) {
    totalHpp = calculatedTotalHpp;
  }

  const grossProfit = hasValue(summary.grossProfit) ? num(summary.grossProfit) : netSales - totalHpp;
  const totalExpenses = num(summary.totalExpenses);
  const netProfit = hasValue(summary.netProfit) ? num(summary.netProfit) : grossProfit - totalExpenses;

  return {
    generatedAt, monthKey, monthLabel, periodLabel, reportKey, reportMode,
    summary: {
      cashSales: num(summary.cashSales), debitSales: num(summary.debitSales), grossProfit, grossSales,
      netProfit, netSales, qrisSales: num(summary.qrisSales), totalDiscount, totalExpenses, totalHpp,
      totalTransactions: num(summary.totalTransactions), sourceTransactionCount: num(firstValue(summary.sourceTransactionCount, metadata.sourceTransactionCount, 0))
    }
  };
}

function padRow(values, length = 12) {
  const row = values.slice();
  while (row.length < length) row.push('');
  return row;
}

function setupReportSheet(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(REPORT_SHEET_NAME) || spreadsheet.insertSheet(REPORT_SHEET_NAME);
  sheet.getRange(1, 1, 1, PRODUCT_HEADERS.length)
    .breakApart().merge()
    .setValue('Santara POS - Laporan Penjualan')
    .setFontWeight('bold').setFontSize(14)
    .setFontColor(COLOR_TEXT_LIGHT).setBackground(COLOR_PRIMARY)
    .setFontFamily(FONT_FAMILY).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 42);
  sheet.setFrozenRows(1);
  
  // Amankan Kolom 12 (Marker) agar tulisannya tidak terlihat (putih)
  const maxRows = sheet.getMaxRows();
  if (maxRows > 0) sheet.getRange(1, 12, maxRows, 1).setFontColor('#FFFFFF');
  
  return sheet;
}

function setupTableSheet(spreadsheet, sheetName, headers) {
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  sheet.getRange(1, 1, 1, headers.length)
    .breakApart().merge()
    .setValue(`Santara POS - ${sheetName}`)
    .setFontWeight('bold').setFontSize(14)
    .setFontColor(COLOR_TEXT_LIGHT).setBackground(COLOR_PRIMARY)
    .setFontFamily(FONT_FAMILY).setHorizontalAlignment('center').setVerticalAlignment('middle');
  
  sheet.getRange(2, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold').setFontSize(10)
    .setBackground(COLOR_SECONDARY).setFontColor(COLOR_TEXT_DARK)
    .setFontFamily(FONT_FAMILY).setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, COLOR_BORDER, SpreadsheetApp.BorderStyle.SOLID);
  
  sheet.setRowHeight(1, 42);
  sheet.setRowHeight(2, 30);
  sheet.setFrozenRows(2);
  return sheet;
}

function setupRawSheet(spreadsheet, sheetName, headers) {
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  const currentHeaders = sheet.getLastColumn() > 0 ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0] : [];
  const isCurrentFormat = currentHeaders.length >= headers.length && headers.every((header, index) => String(currentHeaders[index] || '') === header);

  if (!isCurrentFormat) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground(COLOR_PRIMARY).setFontColor(COLOR_TEXT_LIGHT).setFontFamily(FONT_FAMILY);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function setupSyncLogSheet(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(SYNC_LOG_SHEET_NAME) || spreadsheet.insertSheet(SYNC_LOG_SHEET_NAME);
  const currentHeaders = sheet.getLastColumn() > 0 ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), SYNC_LOG_HEADERS.length)).getValues()[0] : [];
  const isCurrentFormat = currentHeaders.length >= SYNC_LOG_HEADERS.length && SYNC_LOG_HEADERS.every((h, i) => String(currentHeaders[i] || '') === h);
  
  if (!isCurrentFormat) sheet.clear();
  if (sheet.getLastRow() === 0 || !isCurrentFormat) {
    sheet.getRange(1, 1, 1, SYNC_LOG_HEADERS.length).setValues([SYNC_LOG_HEADERS])
      .setFontWeight('bold').setBackground(COLOR_PRIMARY).setFontColor(COLOR_TEXT_LIGHT).setFontFamily(FONT_FAMILY);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function extractDateFromKey(key) {
  if (!key) return '0000-00-00';
  const match = key.match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[1];
  const monthMatch = key.match(/\d{4}-\d{2}/);
  if (monthMatch) return monthMatch[1] + '-00';
  return key;
}

// LOGIKA MARKER KOLOM 12 (TANPA HIDE ROWS)
function getInsertionRowForReport(sheet, newReportKey) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return 2;

  // Cek langsung marker di Kolom ke 12 (L)
  const values = sheet.getRange(1, 12, lastRow, 1).getValues().map(row => String(row[0]));
  const newDate = extractDateFromKey(newReportKey);
  let blocks = [];

  for (let i = 0; i < values.length; i++) {
    if (values[i].indexOf(START_MARKER + ":") === 0) {
      const key = values[i].substring((START_MARKER + ":").length);
      blocks.push({ key: key, startRow: i + 1, date: extractDateFromKey(key) });
    }
  }
  blocks.sort((a, b) => a.startRow - b.startRow);

  for (let block of blocks) {
    if (block.date > newDate) return block.startRow; 
  }
  return lastRow + 2;
}

function deleteExistingReportBlock(sheet, reportKey) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return;

  const values = sheet.getRange(1, 12, lastRow, 1).getValues().map(row => String(row[0]));
  const startMarker = `${START_MARKER}:${reportKey}`;
  const endMarker = `${END_MARKER}:${reportKey}`;
  const startIndex = values.indexOf(startMarker);
  const endIndex = values.indexOf(endMarker);

  if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
    sheet.deleteRows(startIndex + 1, endIndex - startIndex + 1);
  }
}

function replaceReportBlock(sheet, reportKey, payload, normalized) {
  deleteExistingReportBlock(sheet, reportKey);

  const menuSales = payload.menuSales || [];
  const paymentSummary = payload.paymentSummary || [];
  const expenseSummary = payload.expenseSummary || [];
  const dailyClosing = payload.dailyClosing || null;
  const summary = normalized.summary; 
  
  const rawPeriodLabel = String(normalized.periodLabel);
  let displayPeriod = rawPeriodLabel;
  if (!displayPeriod.toLowerCase().startsWith('tanggal')) {
    displayPeriod = `Tanggal: ${displayPeriod}`;
  }

  const rows = [];
  rows.push(padRow([displayPeriod]));
  rows.push(padRow([`Dibuat: ${formatDateTime(normalized.generatedAt)}`]));
  rows.push(padRow([]));
  rows.push(padRow(PRODUCT_HEADERS));

  let totalQty = 0;
  if (menuSales.length === 0) {
    rows.push(padRow(['-', 'Belum ada penjualan menu', 0, 0, 0, 0, 0, 0, 0, 0]));
  } else {
    menuSales.forEach((item, index) => {
      const p = parseMenuItem(item);
      totalQty += p.quantity;
      rows.push(padRow([
        index + 1, p.name, p.unitPrice, p.quantity,
        p.grossSales, p.discountAmount, p.netSales,
        p.hpp, p.estimatedProfit, p.margin
      ]));
    });
  }

  const totalRowIndex = rows.length; 
  const totalMargin = summary.netSales > 0 ? summary.grossProfit / summary.netSales : 0;

  rows.push(padRow([
    '', 'TOTAL', '', totalQty,
    summary.grossSales, summary.totalDiscount, summary.netSales,
    summary.totalHpp, summary.grossProfit, totalMargin
  ]));

  rows.push(padRow([]));
  rows.push(padRow(['💳 Ringkasan Pembayaran']));
  ['Cash', 'QRIS', 'Debit'].forEach((method) => {
    const payment = paymentSummary.find((item) => item.method === method) || {};
    rows.push(padRow([method, toNumber(payment.total), `${toNumber(payment.transactionCount)} transaksi`]));
  });

  rows.push(padRow([]));
  rows.push(padRow(['🏷️ Ringkasan Diskon']));
  rows.push(padRow(['Total diskon', summary.totalDiscount]));
  rows.push(padRow(['Transaksi berdiskon', `${toNumber(payload.discountSummary?.discountedTransactionCount)} transaksi`]));

  rows.push(padRow([]));
  rows.push(padRow(['📉 Ringkasan Pengeluaran']));
  rows.push(padRow(['Total pengeluaran', summary.totalExpenses]));
  if (expenseSummary.length === 0) {
    rows.push(padRow(['Kategori', '-']));
  } else {
    expenseSummary.forEach((expense) => {
      rows.push(padRow([expense.category || 'Lainnya', toNumber(expense.total)]));
    });
  }

  rows.push(padRow([]));
  rows.push(padRow(['💰 Closing Harian']));
  rows.push(padRow(['Kas seharusnya', dailyClosing ? toNumber(dailyClosing.expectedCash) : 0]));
  rows.push(padRow(['Kas aktual', dailyClosing ? toNumber(dailyClosing.actualCash) : 0]));
  rows.push(padRow(['Selisih kas', dailyClosing ? toNumber(dailyClosing.cashDifference) : 0]));
  rows.push(padRow(['Catatan', dailyClosing?.notes || '-']));

  // Sematkan Marker di Kolom 12 secara senyap
  rows[0][11] = `${START_MARKER}:${reportKey}`;
  rows[rows.length - 1][11] = `${END_MARKER}:${reportKey}`;

  const startRow = getInsertionRowForReport(sheet, reportKey);
  sheet.insertRowsBefore(startRow, rows.length);
  
  // Tulis ke sheet
  const targetRange = sheet.getRange(startRow, 1, rows.length, 12);
  targetRange.breakApart();
  targetRange.setValues(rows);

  // Pastikan kolom 12 hurufnya putih agar tidak kelihatan
  sheet.getRange(startRow, 12, rows.length, 1).setFontColor('#FFFFFF');
  
  formatReportBlock(sheet, startRow, rows.length, totalRowIndex);
}

function formatReportBlock(sheet, startRow, rowCount, totalRowIndex) {
  const titleRow = startRow;
  const generatedRow = startRow + 1;
  const headerRow = startRow + 3;
  const totalRow = startRow + totalRowIndex;
  const tableBodyHeight = totalRow - headerRow - 1;

  sheet.getRange(titleRow, 1, 1, PRODUCT_HEADERS.length)
    .breakApart().merge()
    .setFontWeight('bold').setFontSize(12).setFontFamily(FONT_FAMILY)
    .setBackground(COLOR_SECONDARY).setFontColor(COLOR_TEXT_DARK).setHorizontalAlignment('left').setVerticalAlignment('middle');
  sheet.setRowHeight(titleRow, 30);

  sheet.getRange(generatedRow, 1, 1, PRODUCT_HEADERS.length)
    .breakApart().merge()
    .setFontStyle('italic').setFontSize(9).setFontFamily(FONT_FAMILY)
    .setFontColor(COLOR_MUTED_TEXT).setHorizontalAlignment('left').setVerticalAlignment('middle');
  sheet.setRowHeight(generatedRow, 20);

  sheet.getRange(headerRow, 1, 1, PRODUCT_HEADERS.length)
    .setFontWeight('bold').setFontSize(10).setFontFamily(FONT_FAMILY)
    .setBackground(COLOR_PRIMARY).setFontColor(COLOR_TEXT_LIGHT)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(headerRow, 28);

  if (tableBodyHeight > 0) {
    sheet.setRowHeights(headerRow + 1, tableBodyHeight, 24);
    for (let i = 0; i < tableBodyHeight; i++) {
      let currentRow = headerRow + 1 + i;
      let rowBg = (i % 2 === 0) ? COLOR_ZEBRA_ODD : COLOR_ZEBRA_EVEN;
      sheet.getRange(currentRow, 1, 1, PRODUCT_HEADERS.length)
        .setBackground(rowBg).setFontFamily(FONT_FAMILY).setFontColor(COLOR_TEXT_DARK).setFontSize(10).setVerticalAlignment('middle');
    }
  }

  sheet.getRange(headerRow, 1, tableBodyHeight + 2, PRODUCT_HEADERS.length)
    .setBorder(true, true, true, true, true, true, COLOR_BORDER, SpreadsheetApp.BorderStyle.SOLID);

  sheet.getRange(totalRow, 1, 1, PRODUCT_HEADERS.length)
    .setFontWeight('bold').setFontSize(10).setFontFamily(FONT_FAMILY)
    .setBackground(COLOR_TOTAL_BG).setFontColor(COLOR_TEXT_DARK).setVerticalAlignment('middle');
  sheet.setRowHeight(totalRow, 28);

  const productRangeHeight = tableBodyHeight + 1; 
  sheet.getRange(headerRow + 1, 1, productRangeHeight, 1).setHorizontalAlignment('center');
  sheet.getRange(headerRow + 1, 2, productRangeHeight, 1).setHorizontalAlignment('left');
  sheet.getRange(headerRow + 1, 3, productRangeHeight, 1).setNumberFormat('"Rp" #,##0').setHorizontalAlignment('right');
  sheet.getRange(headerRow + 1, 4, productRangeHeight, 1).setNumberFormat('#,##0').setHorizontalAlignment('center');
  sheet.getRange(headerRow + 1, 5, productRangeHeight, 5).setNumberFormat('"Rp" #,##0').setHorizontalAlignment('right');
  sheet.getRange(headerRow + 1, 10, productRangeHeight, 1).setNumberFormat('0.00%').setHorizontalAlignment('right');

  formatSectionBlocks(sheet, startRow, rowCount, totalRowIndex);
  
  sheet.autoResizeColumns(1, PRODUCT_HEADERS.length);
  sheet.setColumnWidth(2, 220); 
}

function formatSectionBlocks(sheet, startRow, rowCount, totalRowIndex) {
  const values = sheet.getRange(startRow, 1, rowCount, 1).getValues();
  const sectionTitles = ['💳 Ringkasan Pembayaran', '🏷️ Ringkasan Diskon', '📉 Ringkasan Pengeluaran', '💰 Closing Harian'];

  values.forEach((row, index) => {
    if (index <= totalRowIndex) return; 

    const currentRow = startRow + index;
    const titleText = String(row[0]);

    if (sectionTitles.includes(titleText)) {
      sheet.getRange(currentRow, 1, 1, PRODUCT_HEADERS.length)
        .breakApart().merge()
        .setFontWeight('bold').setFontSize(11).setFontFamily(FONT_FAMILY)
        .setBackground(COLOR_SECONDARY).setFontColor(COLOR_TEXT_DARK).setHorizontalAlignment('left').setVerticalAlignment('middle')
        .setBorder(true, false, true, false, false, false, COLOR_BORDER, SpreadsheetApp.BorderStyle.SOLID);
      sheet.setRowHeight(currentRow, 28);
    } else if (titleText !== '') {
      const rowRange = sheet.getRange(currentRow, 1, 1, PRODUCT_HEADERS.length);
      rowRange.breakApart(); 
      rowRange.setFontFamily(FONT_FAMILY).setFontSize(10).setFontColor(COLOR_TEXT_DARK).setBackground(COLOR_ZEBRA_ODD).setVerticalAlignment('middle');
      
      sheet.getRange(currentRow, 1, 1, 1).setFontWeight('bold'); 
      const val2 = sheet.getRange(currentRow, 2).getValue();
      if (typeof val2 === 'number') {
        sheet.getRange(currentRow, 2).setNumberFormat('"Rp" #,##0').setHorizontalAlignment('left');
      }
      sheet.getRange(currentRow, 3, 1, PRODUCT_HEADERS.length - 2).breakApart().merge()
        .setFontSize(9).setFontColor(COLOR_MUTED_TEXT).setHorizontalAlignment('left');
      
      sheet.setRowHeight(currentRow, 24);
    }
  });
}

function upsertRawSummary(sheet, normalized) {
  const summary = normalized.summary;
  const row = [
    normalized.reportKey, normalized.monthKey, normalized.monthLabel, normalized.periodLabel, normalized.generatedAt,
    summary.grossSales, summary.totalDiscount, summary.netSales, summary.totalHpp, summary.grossProfit,
    summary.totalExpenses, summary.netProfit, summary.cashSales, summary.qrisSales, summary.debitSales,
    summary.totalTransactions, summary.sourceTransactionCount
  ];
  
  const rowNumber = findRowByFirstColumn(sheet, normalized.reportKey, 2);
  if (rowNumber) {
    sheet.getRange(rowNumber, 1, 1, RAW_SUMMARY_HEADERS.length).setValues([row]);
  } else {
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, RAW_SUMMARY_HEADERS.length).setValues([row]);
  }
}

function replaceRawProducts(sheet, normalized, menuSales) {
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i][0] === normalized.reportKey) sheet.deleteRow(i + 2);
    }
  }

  const rows = (menuSales || []).map((item) => {
    const p = parseMenuItem(item);
    return [
      normalized.reportKey, normalized.monthKey, normalized.monthLabel, normalized.periodLabel,
      p.name, p.category, p.quantity, p.grossSales, p.discountAmount, p.netSales, p.hpp, p.estimatedProfit
    ];
  });
  
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, RAW_PRODUCT_HEADERS.length).setValues(rows);
  }
}

function rebuildMonthlySummary(sheet, rawSummarySheet) {
  const rollups = getMonthlyRollups(rawSummarySheet);
  const lastRow = sheet.getLastRow();
  if (lastRow >= 3) sheet.getRange(3, 1, lastRow - 2, MONTHLY_HEADERS.length).clearContent().clearFormat();
  
  if (rollups.length === 0) return;

  const rows = rollups.map((rollup) => [
    rollup.monthLabel, rollup.grossSales, rollup.totalDiscount, rollup.netSales, rollup.totalHpp,
    rollup.grossProfit, safeDivide(rollup.grossProfit, rollup.netSales), rollup.totalExpenses, rollup.netProfit,
    safeDivide(rollup.netProfit, rollup.netSales), rollup.cashSales, rollup.qrisSales, rollup.debitSales,
    rollup.totalTransactions, safeDivide(rollup.netSales, rollup.totalTransactions), formatDateTime(rollup.generatedAt)
  ]);
  
  sheet.getRange(3, 1, rows.length, MONTHLY_HEADERS.length).setValues(rows);
  
  sheet.setRowHeights(3, rows.length, 24);
  const dataRange = sheet.getRange(3, 1, rows.length, MONTHLY_HEADERS.length);
  dataRange.setFontFamily(FONT_FAMILY).setFontSize(10).setFontColor(COLOR_TEXT_DARK).setVerticalAlignment('middle');
  sheet.getRange(2, 1, rows.length + 1, MONTHLY_HEADERS.length).setBorder(true, true, true, true, true, true, COLOR_BORDER, SpreadsheetApp.BorderStyle.SOLID);
  
  for (let i = 0; i < rows.length; i++) {
    sheet.getRange(3 + i, 1, 1, MONTHLY_HEADERS.length).setBackground((i % 2 === 0) ? COLOR_ZEBRA_ODD : COLOR_ZEBRA_EVEN);
  }

  sheet.getRange(3, 1, rows.length, 1).setHorizontalAlignment('center');
  sheet.getRange(3, 2, rows.length, 5).setNumberFormat('"Rp" #,##0').setHorizontalAlignment('right');
  sheet.getRange(3, 7, rows.length, 1).setNumberFormat('0.00%').setHorizontalAlignment('right');
  sheet.getRange(3, 8, rows.length, 2).setNumberFormat('"Rp" #,##0').setHorizontalAlignment('right');
  sheet.getRange(3, 10, rows.length, 1).setNumberFormat('0.00%').setHorizontalAlignment('right');
  sheet.getRange(3, 11, rows.length, 3).setNumberFormat('"Rp" #,##0').setHorizontalAlignment('right');
  sheet.getRange(3, 14, rows.length, 1).setNumberFormat('#,##0').setHorizontalAlignment('center');
  sheet.getRange(3, 15, rows.length, 1).setNumberFormat('"Rp" #,##0').setHorizontalAlignment('right');
  sheet.getRange(3, 16, rows.length, 1).setHorizontalAlignment('center');
  sheet.autoResizeColumns(1, MONTHLY_HEADERS.length);
}

function rebuildProductMonthlySummary(sheet, rawProductSheet) {
  const productRows = getRawProductRows(rawProductSheet);
  const productMap = new Map();

  productRows.filter((row) => row.monthKey).forEach((row) => {
    const key = `${row.monthKey}|${row.productName}|${row.category}`;
    const current = productMap.get(key) || createProductRollup(row);
    current.quantity += row.quantity;
    current.grossSales += row.grossSales;
    current.discount += row.discount;
    current.netSales += row.netSales;
    current.hpp += row.hpp;
    current.profit += row.profit;
    productMap.set(key, current);
  });

  const rows = Array.from(productMap.values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey) || b.quantity - a.quantity)
    .map((r) => [r.monthLabel, r.productName, r.category, r.quantity, r.grossSales, r.discount, r.netSales, r.hpp, r.profit, safeDivide(r.profit, r.netSales)]);

  const lastRow = sheet.getLastRow();
  if (lastRow >= 3) sheet.getRange(3, 1, lastRow - 2, PRODUCT_MONTHLY_HEADERS.length).clearContent().clearFormat();
  
  if (rows.length > 0) {
    sheet.getRange(3, 1, rows.length, PRODUCT_MONTHLY_HEADERS.length).setValues(rows);
    
    sheet.setRowHeights(3, rows.length, 24);
    const dataRange = sheet.getRange(3, 1, rows.length, PRODUCT_MONTHLY_HEADERS.length);
    dataRange.setFontFamily(FONT_FAMILY).setFontSize(10).setFontColor(COLOR_TEXT_DARK).setVerticalAlignment('middle');
    sheet.getRange(2, 1, rows.length + 1, PRODUCT_MONTHLY_HEADERS.length).setBorder(true, true, true, true, true, true, COLOR_BORDER, SpreadsheetApp.BorderStyle.SOLID);
    
    for (let i = 0; i < rows.length; i++) {
      sheet.getRange(3 + i, 1, 1, PRODUCT_MONTHLY_HEADERS.length).setBackground((i % 2 === 0) ? COLOR_ZEBRA_ODD : COLOR_ZEBRA_EVEN);
    }
    
    sheet.getRange(3, 1, rows.length, 1).setHorizontalAlignment('center');
    sheet.getRange(3, 2, rows.length, 2).setHorizontalAlignment('left');
    sheet.getRange(3, 4, rows.length, 1).setNumberFormat('#,##0').setHorizontalAlignment('center');
    sheet.getRange(3, 5, rows.length, 5).setNumberFormat('"Rp" #,##0').setHorizontalAlignment('right');
    sheet.getRange(3, 10, rows.length, 1).setNumberFormat('0.00%').setHorizontalAlignment('right');
    sheet.autoResizeColumns(1, PRODUCT_MONTHLY_HEADERS.length);
  }
}

function rebuildAllTimeSummary(sheet, rawSummarySheet) {
  const rawRows = getRawSummaryRows(rawSummarySheet);
  const totals = rawRows.reduce((total, rollup) => addSummaryTotals(total, rollup), createEmptySummary());
  const lastSync = rawRows.reduce((latest, r) => {
    return new Date(r.generatedAt).getTime() > new Date(latest || 0).getTime() ? r.generatedAt : latest;
  }, '');

  const rows = [
    ['Penjualan Kotor', totals.grossSales], ['Total Diskon', totals.totalDiscount], ['Penjualan Bersih', totals.netSales],
    ['Total HPP', totals.totalHpp], ['Laba Kotor', totals.grossProfit], ['Gross Margin', safeDivide(totals.grossProfit, totals.netSales)],
    ['Total Pengeluaran', totals.totalExpenses], ['Laba Bersih', totals.netProfit], ['Net Margin', safeDivide(totals.netProfit, totals.netSales)],
    ['Cash Sales', totals.cashSales], ['QRIS Sales', totals.qrisSales], ['Debit Sales', totals.debitSales],
    ['Total Transaksi', totals.totalTransactions], ['Average Transaction Value', safeDivide(totals.netSales, totals.totalTransactions)],
    ['Last Sync', lastSync ? formatDateTime(lastSync) : '-']
  ];

  const lastRow = sheet.getLastRow();
  if (lastRow >= 3) sheet.getRange(3, 1, lastRow - 2, ALL_TIME_HEADERS.length).clearContent().clearFormat();
  
  sheet.getRange(3, 1, rows.length, ALL_TIME_HEADERS.length).setValues(rows);
  
  sheet.setRowHeights(3, rows.length, 24);
  const dataRange = sheet.getRange(3, 1, rows.length, ALL_TIME_HEADERS.length);
  dataRange.setFontFamily(FONT_FAMILY).setFontSize(10).setFontColor(COLOR_TEXT_DARK).setVerticalAlignment('middle');
  sheet.getRange(2, 1, rows.length + 1, ALL_TIME_HEADERS.length).setBorder(true, true, true, true, true, true, COLOR_BORDER, SpreadsheetApp.BorderStyle.SOLID);
  
  for (let i = 0; i < rows.length; i++) {
    sheet.getRange(3 + i, 1, 1, ALL_TIME_HEADERS.length).setBackground((i % 2 === 0) ? COLOR_ZEBRA_ODD : COLOR_ZEBRA_EVEN);
  }

  rows.forEach((row, index) => {
    const metric = row[0];
    const valueCell = sheet.getRange(index + 3, 2);
    sheet.getRange(index + 3, 1).setFontWeight('bold');

    if (metric.includes('Margin')) {
      valueCell.setNumberFormat('0.00%').setHorizontalAlignment('right');
    } else if (metric.includes('Transaksi')) {
      valueCell.setNumberFormat('#,##0').setHorizontalAlignment('center');
    } else if (metric === 'Last Sync') {
      valueCell.setHorizontalAlignment('center');
    } else {
      valueCell.setNumberFormat('"Rp" #,##0').setHorizontalAlignment('right');
    }
  });
  sheet.autoResizeColumns(1, ALL_TIME_HEADERS.length);
}

function getMonthlyRollups(rawSummarySheet) {
  const rows = getRawSummaryRows(rawSummarySheet);
  const monthMap = new Map();
  rows.filter((row) => row.monthKey).forEach((row) => {
    const current = monthMap.get(row.monthKey) || createMonthRollup(row);
    monthMap.set(row.monthKey, addSummaryTotals(current, row));
  });
  return Array.from(monthMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

function getRawSummaryRows(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, RAW_SUMMARY_HEADERS.length).getValues().map((row) => {
    const monthKey = getMonthKey(firstValue(row[1], row[2], row[0]));
    return {
      reportKey: String(row[0] || ''), monthKey, monthLabel: getMonthLabel(monthKey), periodLabel: String(row[3] || ''), generatedAt: row[4],
      grossSales: num(row[5]), totalDiscount: num(row[6]), netSales: num(row[7]), totalHpp: num(row[8]), grossProfit: num(row[9]),
      totalExpenses: num(row[10]), netProfit: num(row[11]), cashSales: num(row[12]), qrisSales: num(row[13]), debitSales: num(row[14]),
      totalTransactions: num(row[15]), sourceTransactionCount: num(row[16])
    };
  });
}

function getRawProductRows(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, RAW_PRODUCT_HEADERS.length).getValues().map((row) => {
    const monthKey = getMonthKey(firstValue(row[1], row[2], row[0]));
    return {
      reportKey: String(row[0] || ''), monthKey, monthLabel: getMonthLabel(monthKey), periodLabel: String(row[3] || ''),
      productName: String(row[4] || ''), category: String(row[5] || ''), quantity: num(row[6]), grossSales: num(row[7]),
      discount: num(row[8]), netSales: num(row[9]), hpp: num(row[10]), profit: num(row[11])
    };
  });
}

function createMonthRollup(row) { return { ...createEmptySummary(), monthKey: row.monthKey, monthLabel: getMonthLabel(row.monthKey), generatedAt: row.generatedAt }; }
function createProductRollup(row) { return { monthKey: row.monthKey, monthLabel: getMonthLabel(row.monthKey), productName: row.productName, category: row.category, quantity: 0, grossSales: 0, discount: 0, netSales: 0, hpp: 0, profit: 0 }; }
function createEmptySummary() { return { grossSales: 0, totalDiscount: 0, netSales: 0, totalHpp: 0, grossProfit: 0, totalExpenses: 0, netProfit: 0, cashSales: 0, qrisSales: 0, debitSales: 0, totalTransactions: 0 }; }

function addSummaryTotals(total, row) {
  total.grossSales += row.grossSales; total.totalDiscount += row.totalDiscount; total.netSales += row.netSales;
  total.totalHpp += row.totalHpp; total.grossProfit += row.grossProfit; total.totalExpenses += row.totalExpenses;
  total.netProfit += row.netProfit; total.cashSales += row.cashSales; total.qrisSales += row.qrisSales;
  total.debitSales += row.debitSales; total.totalTransactions += row.totalTransactions;
  if (row.generatedAt && new Date(row.generatedAt).getTime() > new Date(total.generatedAt || 0).getTime()) { total.generatedAt = row.generatedAt; }
  return total;
}

function findRowByFirstColumn(sheet, key, headerRows) {
  const lastRow = sheet.getLastRow();
  if (lastRow < headerRows) return null;
  const values = sheet.getRange(headerRows, 1, lastRow - headerRows + 1, 1).getValues();
  for (let i = 0; i < values.length; i++) { if (values[i][0] === key) return i + headerRows; }
  return null;
}

function appendSyncLog(sheet, syncedAt, reportKey, monthKey, menuRowsProcessed, internalSummaryRows, internalProductRows, reportMode, status, message) {
  sheet.appendRow([syncedAt, reportKey, monthKey || '-', num(menuRowsProcessed), num(internalSummaryRows), num(internalProductRows), reportMode, status, message]);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 4, lastRow - 1, 3).setNumberFormat('#,##0');
  sheet.autoResizeColumns(1, SYNC_LOG_HEADERS.length);
}

function buildFallbackReportKey(metadata) {
  const mode = metadata.reportModeSlug || metadata.reportMode || 'report';
  const date = metadata.periodValue || metadata.selectedDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return `${String(mode).toLowerCase().replace(/\s+/g, '-')}-${date}`;
}

function deriveMonthKey(metadata, summary, reportKey, generatedAt) {
  if (String(firstValue(metadata.reportModeSlug, '')).toLowerCase() === 'semua-waktu' || reportKey === 'semua-waktu') return '';
  return normalizeMonthKey(firstValue(metadata.monthKey, summary.monthKey, metadata.periodValue, summary.periodValue, metadata.selectedDate, reportKey, generatedAt));
}

function getMonthKey(value) { return normalizeMonthKey(value); }

function normalizeMonthKey(value) {
  if (!hasValue(value)) return '';
  if (value instanceof Date && !isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  const txt = String(value);
  const match = txt.match(/(\d{4}-\d{2})/);
  if (match) return match[1];
  const d = new Date(txt);
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return '';
}

function getMonthLabel(value) {
  const mk = getMonthKey(value);
  if (!mk) return '';
  const parts = String(mk).split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!year || !month) return String(value || '');
  const mNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${mNames[month - 1] || month} ${year}`;
}

function formatDateTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value || '-');
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd MMMM yyyy HH:mm');
}

function toNumber(value) { return num(value); }
function toPercent(value) { const nv = num(value); return Math.abs(nv) > 1 ? nv / 100 : nv; }

function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value instanceof Date || !hasValue(value)) return 0;
  const cleaned = String(value).trim().replace(/Rp/gi, '').replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === ',' || cleaned === '.') return 0;
  let norm = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) norm = cleaned.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) norm = cleaned.replace(/\./g, '');
  else if (cleaned.includes(',')) norm = cleaned.replace(',', '.');
  const nv = Number(norm);
  return Number.isFinite(nv) ? nv : 0;
}

function firstNumberValue() {
  for (let i = 0; i < arguments.length; i++) {
    if (hasValue(arguments[i])) {
      return num(arguments[i]);
    }
  }
  return null;
}
function firstValue(...v) { for (let i = 0; i < v.length; i++) { if (hasValue(v[i])) return v[i]; } return ''; }
function hasValue(v) { return v !== undefined && v !== null && v !== ''; }
function safeDivide(n, d) { return num(d) > 0 ? num(n) / num(d) : 0; }
function jsonResponse(p) { return ContentService.createTextOutput(JSON.stringify(p)).setMimeType(ContentService.MimeType.JSON); }

function resetSantaraReportData() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetsToClear = [
    RAW_SUMMARY_SHEET_NAME,
    RAW_PRODUCT_SHEET_NAME,
    MONTHLY_SHEET_NAME,
    PRODUCT_MONTHLY_SHEET_NAME,
    ALL_TIME_SHEET_NAME,
    SYNC_LOG_SHEET_NAME
  ];

  sheetsToClear.forEach(sheetName => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (sheet) {
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent().clearFormat();
      }
    }
  });
}
```

## 3. Deploy as Web App

1. Click Deploy.
2. Choose New deployment.
3. Select Web app.
4. Set Execute as: `Me`.
5. Set Who has access: `Anyone`.
6. Click Deploy.
7. Copy the Web App URL.

The URL should look like:

```text
https://script.google.com/macros/s/.../exec
```

## 4. Save the URL in Santara POS

1. Open Santara POS.
2. Login as owner or admin.
3. Open `Laporan`.
4. Paste the Apps Script URL into `URL Apps Script`.
5. Click `Simpan URL`.
6. Click `Sync Google Sheet`.

## 5. How Sync Updates the Sheets

Santara POS sends an internal `Report Key`, but the key is hidden in the main
report sheet. The visible report uses a readable label such as:

* `Tanggal: 14 Juni 2026`
* `Periode: Juni 2026`
* `Periode: Semua Waktu`

The script updates these sheets:

* `Laporan Penjualan`: replaces the old block for the same date or period.
* `_Data Rekap Internal`: upserts one raw numeric source row by `Report Key`.
* `_Data Produk Internal`: replaces old raw numeric product rows for the same `Report Key`.
* `Rekap Bulanan`: recalculates monthly rows from stored synced data.
* `Rekap Produk Bulanan`: recalculates product rows from stored synced data.
* `Rekap Keseluruhan`: recalculates automatically after every successful sync.
* `Sync Logs`: appends every sync attempt with report key, month key, processed menu rows, internal row counts, status, and message.

You do not need to sync `Semua Waktu` just to update `Rekap Keseluruhan`.
Syncing daily or monthly reports is enough because the script stores each synced
date/month once, then recalculates all-time totals from those stored rows.

If you sync the same date again, the hidden stored row for that date is updated,
not duplicated. That means corrections, voids, or deleted receipts can increase
or decrease the all-time totals correctly after you sync the corrected date.

## 6. Test Safely

If you are using a Google Sheet that already contains broken data from old
script tests, run `resetSantaraReportData()` once from Apps Script first. You
can also start with a fresh Google Sheet.

Then use `Hari Ini` first with a small test report.

Check:

* `Laporan Penjualan` has a readable report block.
* `_Data Rekap Internal` has one clean row for the synced report key/date.
* `_Data Produk Internal` has product rows for the synced report key/date.
* `Jumlah Terjual` is a plain number, not Rupiah.
* The product table has blue headers and a pink total row.
* Payment, discount, expenses, and closing summaries appear below the product table.
* `Rekap Bulanan` is filled with one row for `Juni 2026` or the correct synced month.
* `Rekap Produk Bulanan` is filled with product rows for the month, and the `Bulan` column is a readable month label.
* `Rekap Keseluruhan` has correct non-zero totals after the daily sync.
* `Sync Logs` records the sync attempt.

Then click `Sync Google Sheet` again for the same period. The old report block,
internal rows, recap rows, and all-time totals should update without double counting.

Finally, sync another date with sales and confirm monthly/all-time totals
increase correctly.

If sync fails, Santara POS still keeps data locally. Check that the Apps Script
deployment is active and that the URL ends with `/exec`.

# Google Sheets Sync - Santara POS

Santara POS syncs reports to Google Sheets through a simple Google Apps Script
Web App URL.

This is intentionally simple:

* No Google OAuth inside Santara POS.
* No Google API client inside Santara POS.
* The app sends the selected report to your Apps Script endpoint.
* Apps Script writes the data into your Google Sheet.

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

```js
const SPREADSHEET_ID = 'SPREADSHEET_ID_HERE';

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);

    writeKeyValueSheet(spreadsheet, 'Summary', [
      ['Generated At', payload.metadata?.generatedAt],
      ['Report Mode', payload.metadata?.reportMode],
      ['Selected Date', payload.metadata?.selectedDate],
      ['Synced By', payload.metadata?.syncedBy],
      ['Gross Sales', payload.summary?.grossSales],
      ['Total Discount', payload.summary?.totalDiscount],
      ['Net Sales', payload.summary?.netSales],
      ['Total HPP', payload.summary?.totalHpp],
      ['Gross Profit', payload.summary?.grossProfit],
      ['Gross Margin', payload.summary?.grossMargin],
      ['Total Expenses', payload.summary?.totalExpenses],
      ['Net Profit', payload.summary?.netProfit],
      ['Net Margin', payload.summary?.netMargin],
      ['Total Transactions', payload.summary?.totalTransactions],
      ['Average Transaction Value', payload.summary?.averageTransactionValue],
    ]);

    writeTableSheet(spreadsheet, 'Payment', ['Method', 'Transaction Count', 'Total'], payload.paymentSummary || []);
    writeTableSheet(spreadsheet, 'Discount', ['Metric', 'Value'], [
      { metric: 'Total Discount', value: payload.discountSummary?.totalDiscountAmount },
      { metric: 'Discounted Transactions', value: payload.discountSummary?.discountedTransactionCount },
      { metric: 'Average Discount', value: payload.discountSummary?.averageDiscount },
    ]);
    writeTableSheet(spreadsheet, 'Menu Sales', [
      'Menu',
      'Category',
      'Qty',
      'Gross Sales',
      'Discount',
      'Net Sales',
      'HPP',
      'Profit',
      'Margin',
    ], payload.menuSales || []);
    writeTableSheet(spreadsheet, 'Best Sellers', ['Rank', 'Menu', 'Qty', 'Net Sales'], payload.bestSellers || []);
    writeTableSheet(spreadsheet, 'Expenses', ['Date', 'Name', 'Category', 'Amount', 'Payment Method', 'Notes'], payload.expenseList || []);
    writeKeyValueSheet(spreadsheet, 'Closing', [
      ['Date', payload.dailyClosing?.closingDate],
      ['Expected Cash', payload.dailyClosing?.expectedCash],
      ['Actual Cash', payload.dailyClosing?.actualCash],
      ['Cash Difference', payload.dailyClosing?.cashDifference],
      ['Notes', payload.dailyClosing?.notes],
    ]);
    appendSyncLog(spreadsheet, payload);

    return jsonResponse({ ok: true, message: 'Data berhasil dikirim ke Google Sheets.' });
  } catch (error) {
    return jsonResponse({ ok: false, message: String(error) });
  }
}

function writeKeyValueSheet(spreadsheet, sheetName, rows) {
  const sheet = getOrCreateSheet(spreadsheet, sheetName);
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.autoResizeColumns(1, 2);
}

function writeTableSheet(spreadsheet, sheetName, headers, rows) {
  const sheet = getOrCreateSheet(spreadsheet, sheetName);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const values = rows.map((row, index) => mapRow(sheetName, row, index));
  if (values.length > 0) {
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  }

  sheet.autoResizeColumns(1, headers.length);
}

function mapRow(sheetName, row, index) {
  if (sheetName === 'Payment') {
    return [row.method, row.transactionCount, row.total];
  }

  if (sheetName === 'Discount') {
    return [row.metric, row.value];
  }

  if (sheetName === 'Menu Sales') {
    return [
      row.name,
      row.category,
      row.quantity,
      row.grossSales,
      row.discountAmount,
      row.netSales,
      row.hpp,
      row.estimatedProfit,
      row.margin,
    ];
  }

  if (sheetName === 'Best Sellers') {
    return [row.rank || index + 1, row.name || row.menu, row.quantity, row.netSales];
  }

  if (sheetName === 'Expenses') {
    return [row.date, row.name, row.category, row.amount, row.paymentMethod, row.notes];
  }

  return Object.values(row);
}

function appendSyncLog(spreadsheet, payload) {
  const sheet = getOrCreateSheet(spreadsheet, 'Sync Logs');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Synced At', 'Report Mode', 'Selected Date', 'Synced By']);
  }

  sheet.appendRow([
    payload.metadata?.generatedAt,
    payload.metadata?.reportMode,
    payload.metadata?.selectedDate,
    payload.metadata?.syncedBy,
  ]);
}

function getOrCreateSheet(spreadsheet, sheetName) {
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
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

## 5. Test Safely

Use `Hari Ini` first with a small test report.

Check these sheets:

* Summary
* Payment
* Discount
* Menu Sales
* Best Sellers
* Expenses
* Closing
* Sync Logs

If sync fails, Santara POS still keeps data locally. Check that the Apps Script
deployment is active and that the URL ends with `/exec`.

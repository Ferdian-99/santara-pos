import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type {
  AppStateData,
  CompletedTransaction,
  DailyClosing,
  DiscountType,
  Expense,
  ExpensePaymentMethod,
  GoogleSheetSyncLog,
  GoogleSheetSyncSettings,
  LegacyImportBatch,
  LegacySale,
  MenuItem,
  PaymentMethod,
  PendingOrder,
  TransactionItem,
} from '../types';
import type { SyncOperation } from './syncQueue';

type DbRow = Record<string, unknown>;

const CASHIER_NAME = 'Santara Cashier';

export function canUseSupabase() {
  return isSupabaseConfigured && Boolean(supabase);
}

export async function pushSyncOperation(operation: SyncOperation) {
  if (!supabase) {
    throw new Error('Supabase belum dikonfigurasi.');
  }

  const payload = operation.payload;

  if (operation.type === 'menu-snapshot-upsert' && 'menuItems' in payload) {
    await upsertMenuItems(payload.menuItems);
    return;
  }

  if (operation.type === 'transaction-upsert' && 'transaction' in payload) {
    await upsertTransaction(payload.transaction);
    return;
  }

  if (operation.type === 'pending-order-upsert' && 'pendingOrder' in payload) {
    await upsertPendingOrder(payload.pendingOrder);
    return;
  }

  if (operation.type === 'pending-order-delete' && 'pendingOrderId' in payload) {
    await deletePendingOrder(payload.pendingOrderId);
    return;
  }

  if (operation.type === 'app-settings-upsert' && 'receiptCounter' in payload) {
    await upsertReceiptCounter(payload.receiptCounter);
    return;
  }

  if (operation.type === 'legacy-import-upsert' && 'batch' in payload) {
    await upsertLegacyImport(payload.batch, payload.sales);
    return;
  }

  if (operation.type === 'expense-upsert' && 'expense' in payload) {
    await upsertExpense(payload.expense);
    return;
  }

  if (operation.type === 'expense-delete' && 'expenseId' in payload) {
    await deleteExpense(payload.expenseId);
    return;
  }

  if (operation.type === 'daily-closing-upsert' && 'dailyClosing' in payload) {
    await upsertDailyClosing(payload.dailyClosing);
    return;
  }

  if (
    operation.type === 'google-sheet-settings-upsert' &&
    'googleSheetSyncSettings' in payload
  ) {
    await upsertGoogleSheetSettings(payload.googleSheetSyncSettings);
    return;
  }

  if (
    operation.type === 'google-sheet-sync-log-upsert' &&
    'googleSheetSyncLog' in payload
  ) {
    await upsertGoogleSheetSyncLog(payload.googleSheetSyncLog);
  }
}

export async function pullCloudAppState(
  currentData: AppStateData,
): Promise<AppStateData | null> {
  if (!supabase) {
    return null;
  }

  const [
    menuItems,
    completedTransactions,
    pendingOrders,
    receiptCounter,
    legacyData,
    expenses,
    dailyClosings,
    googleSheetSyncSettings,
    googleSheetSyncLogs,
  ] =
    await Promise.all([
      fetchMenuItems(),
      fetchTransactions(),
      fetchPendingOrders(),
      fetchReceiptCounter(),
      fetchLegacyImports(),
      fetchExpenses(),
      fetchDailyClosings(),
      fetchGoogleSheetSettings(),
      fetchGoogleSheetSyncLogs(),
    ]);

  const hasCloudData =
    menuItems.length > 0 ||
    completedTransactions.length > 0 ||
    pendingOrders.length > 0 ||
    legacyData.sales.length > 0 ||
    legacyData.batches.length > 0 ||
    expenses.length > 0 ||
    dailyClosings.length > 0 ||
    googleSheetSyncSettings !== null ||
    googleSheetSyncLogs.length > 0 ||
    receiptCounter !== null;

  if (!hasCloudData) {
    return null;
  }

  return {
    menuItems: menuItems.length > 0 ? menuItems : currentData.menuItems,
    pendingOrders:
      pendingOrders.length > 0 || currentData.pendingOrders.length === 0
        ? pendingOrders
        : currentData.pendingOrders,
    completedTransactions:
      completedTransactions.length > 0
        ? mergeTransactions(currentData.completedTransactions, completedTransactions)
        : currentData.completedTransactions,
    legacySales:
      legacyData.sales.length > 0
        ? mergeLegacySales(currentData.legacySales, legacyData.sales)
        : currentData.legacySales,
    legacyImportBatches:
      legacyData.batches.length > 0
        ? mergeLegacyBatches(currentData.legacyImportBatches, legacyData.batches)
        : currentData.legacyImportBatches,
    expenses:
      expenses.length > 0
        ? mergeExpenses(currentData.expenses, expenses)
        : currentData.expenses,
    dailyClosings:
      dailyClosings.length > 0
        ? mergeDailyClosings(currentData.dailyClosings, dailyClosings)
        : currentData.dailyClosings,
    googleSheetSyncSettings:
      googleSheetSyncSettings ?? currentData.googleSheetSyncSettings,
    googleSheetSyncLogs:
      googleSheetSyncLogs.length > 0
        ? mergeGoogleSheetSyncLogs(
            currentData.googleSheetSyncLogs,
            googleSheetSyncLogs,
          )
        : currentData.googleSheetSyncLogs,
    receiptCounter: Math.max(
      currentData.receiptCounter,
      receiptCounter ?? 0,
      getReceiptCounterFromTransactions(completedTransactions),
    ),
  };
}

async function upsertMenuItems(menuItems: MenuItem[]) {
  if (!supabase || menuItems.length === 0) {
    return;
  }

  const categoryNames = Array.from(
    new Set(menuItems.map((item) => item.category).filter(Boolean)),
  );
  const categories = categoryNames.map((name, index) => ({
    id: stableUuid('category', name),
    name,
    sort_order: index,
    is_active: true,
  }));

  if (categories.length > 0) {
    const { error } = await supabase
      .from('menu_categories')
      .upsert(categories, { onConflict: 'id' });
    throwIfError(error, 'Gagal menyinkronkan kategori menu.');
  }

  const rows = menuItems.map((item) => ({
    id: stableUuid('menu', item.id),
    category_id: stableUuid('category', item.category),
    category_name: item.category,
    name: item.name,
    price: item.price,
    hpp: item.hpp,
    is_active: item.isActive,
  }));
  const { error } = await supabase
    .from('menu_items')
    .upsert(rows, { onConflict: 'id' });

  throwIfError(error, 'Gagal menyinkronkan menu.');
}

async function upsertTransaction(transaction: CompletedTransaction) {
  if (!supabase) {
    return;
  }

  const transactionId = stableUuid('transaction', transaction.receiptNumber);
  const { error: transactionError } = await supabase.from('transactions').upsert(
    {
      id: transactionId,
      receipt_number: transaction.receiptNumber,
      transaction_at: transaction.dateTime,
      cashier_name: transaction.cashierName || CASHIER_NAME,
      subtotal_before_discount: transaction.subtotalBeforeDiscount,
      discount_type: transaction.discountType,
      discount_value: transaction.discountValue,
      discount_amount: transaction.discountAmount,
      total_after_discount: transaction.totalAfterDiscount,
      payment_method: transaction.paymentMethod,
      paid_amount: transaction.paidAmount,
      change_amount: transaction.changeAmount,
    },
    { onConflict: 'id' },
  );

  throwIfError(transactionError, 'Gagal menyinkronkan transaksi.');

  const items = transaction.items.map((item, index) => ({
    id: stableUuid(
      'transaction-item',
      `${transaction.receiptNumber}:${item.id}:${index}`,
    ),
    transaction_id: transactionId,
    menu_item_id: null,
    menu_name_snapshot: item.nameSnapshot,
    category_name_snapshot: item.categorySnapshot,
    unit_price_snapshot: item.unitPriceSnapshot,
    hpp_snapshot: item.hppSnapshot ?? 0,
    quantity: item.quantity,
    subtotal: item.subtotal,
  }));

  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from('transaction_items')
      .upsert(items, { onConflict: 'id' });
    throwIfError(itemsError, 'Gagal menyinkronkan item transaksi.');
  }
}

async function upsertPendingOrder(order: PendingOrder) {
  if (!supabase) {
    return;
  }

  const pendingOrderId = stableUuid('pending-order', order.id);
  const { error: orderError } = await supabase.from('pending_orders').upsert(
    {
      id: pendingOrderId,
      label: order.label,
      cashier_name: CASHIER_NAME,
      created_at: order.createdAt,
    },
    { onConflict: 'id' },
  );

  throwIfError(orderError, 'Gagal menyinkronkan order tersimpan.');

  const items = order.items.map((item, index) => ({
    id: stableUuid('pending-order-item', `${order.id}:${item.id}:${index}`),
    pending_order_id: pendingOrderId,
    menu_item_id: null,
    menu_name_snapshot: item.nameSnapshot,
    category_name_snapshot: item.categorySnapshot,
    unit_price_snapshot: item.unitPriceSnapshot,
    hpp_snapshot: item.hppSnapshot ?? 0,
    quantity: item.quantity,
  }));

  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from('pending_order_items')
      .upsert(items, { onConflict: 'id' });
    throwIfError(itemsError, 'Gagal menyinkronkan item order tersimpan.');
  }
}

async function deletePendingOrder(pendingOrderId: string) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from('pending_orders')
    .delete()
    .eq('id', stableUuid('pending-order', pendingOrderId));

  throwIfError(error, 'Gagal menghapus order tersimpan di cloud.');
}

async function upsertReceiptCounter(receiptCounter: number) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from('app_settings').upsert(
    {
      key: 'receipt_counter',
      value: {
        receiptCounter,
      },
      description: 'Last Santara POS receipt counter synced from local app.',
    },
    { onConflict: 'key' },
  );

  throwIfError(error, 'Gagal menyinkronkan nomor struk.');
}

async function upsertLegacyImport(
  batch: LegacyImportBatch,
  sales: LegacySale[],
) {
  if (!supabase) {
    return;
  }

  const batchId = stableUuid('legacy-import-batch', batch.id);
  const { error: batchError } = await supabase
    .from('legacy_import_batches')
    .upsert(
      {
        id: batchId,
        local_id: batch.id,
        file_name: batch.fileName,
        imported_at: batch.importedAt,
        imported_by_name: batch.importedBy,
        total_rows: batch.totalRows,
        date_start: batch.dateStart || null,
        date_end: batch.dateEnd || null,
        total_gross_sales: batch.totalGrossSales,
        total_discount: batch.totalDiscount,
        total_net_sales: batch.totalNetSales,
        total_hpp: batch.totalHpp,
      },
      { onConflict: 'id' },
    );

  throwIfError(batchError, 'Gagal menyinkronkan batch import lama.');

  const rows = sales.map((sale) => ({
    id: stableUuid('legacy-sale', sale.id),
    local_id: sale.id,
    import_batch_id: batchId,
    sale_date: sale.saleDate,
    menu_name: sale.menuName,
    category_name: sale.category,
    quantity: sale.quantity,
    gross_sales: sale.grossSales,
    discount_amount: sale.discountAmount,
    net_sales: sale.netSales,
    hpp_total: sale.hppTotal,
    payment_method: sale.paymentMethod || 'Legacy',
    notes: sale.notes,
    source: 'legacy_import',
    imported_by_name: sale.importedBy,
    imported_at: sale.importedAt,
  }));

  if (rows.length > 0) {
    const { error: salesError } = await supabase
      .from('legacy_sales')
      .upsert(rows, { onConflict: 'id' });
    throwIfError(salesError, 'Gagal menyinkronkan data import lama.');
  }
}

async function upsertExpense(expense: Expense) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from('expenses').upsert(
    {
      id: stableUuid('expense', expense.id),
      local_id: expense.id,
      expense_date: expense.date,
      name: expense.name,
      category: expense.category,
      amount: expense.amount,
      payment_method: expense.paymentMethod,
      notes: expense.notes,
      created_by_name: expense.createdBy,
      created_at: expense.createdAt,
      updated_at: expense.updatedAt,
    },
    { onConflict: 'id' },
  );

  throwIfError(error, 'Gagal menyinkronkan pengeluaran.');
}

async function deleteExpense(expenseId: string) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', stableUuid('expense', expenseId));

  throwIfError(error, 'Gagal menghapus pengeluaran di cloud.');
}

async function upsertDailyClosing(dailyClosing: DailyClosing) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from('daily_closings').upsert(
    {
      id: stableUuid('daily-closing', dailyClosing.id),
      local_id: dailyClosing.id,
      closing_date: dailyClosing.closingDate,
      cashier_name: dailyClosing.cashierName,
      gross_sales: dailyClosing.grossSales,
      total_discount: dailyClosing.totalDiscount,
      net_sales: dailyClosing.netSales,
      total_hpp: dailyClosing.totalHpp,
      gross_profit: dailyClosing.grossProfit,
      total_expenses: dailyClosing.totalExpenses,
      net_profit: dailyClosing.netProfit,
      cash_sales: dailyClosing.cashSales,
      qris_sales: dailyClosing.qrisSales,
      debit_sales: dailyClosing.debitSales,
      expected_cash: dailyClosing.expectedCash,
      actual_cash: dailyClosing.actualCash,
      cash_difference: dailyClosing.cashDifference,
      notes: dailyClosing.notes,
      created_by_name: dailyClosing.createdBy,
      created_at: dailyClosing.createdAt,
      updated_at: dailyClosing.updatedAt,
    },
    { onConflict: 'id' },
  );

  throwIfError(error, 'Gagal menyinkronkan closing harian.');
}

async function upsertGoogleSheetSettings(settings: GoogleSheetSyncSettings) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from('google_sheet_sync_settings').upsert(
    {
      id: stableUuid('google-sheet-settings', 'default'),
      endpoint_url: settings.endpointUrl,
      is_enabled: settings.isEnabled,
      updated_by_name: settings.updatedBy,
      updated_at: settings.updatedAt ?? new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  throwIfError(error, 'Gagal menyinkronkan pengaturan Google Sheet.');
}

async function upsertGoogleSheetSyncLog(log: GoogleSheetSyncLog) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from('google_sheet_sync_logs').upsert(
    {
      id: stableUuid('google-sheet-sync-log', log.id),
      local_id: log.id,
      report_mode: log.reportMode,
      selected_date: log.selectedDate,
      status: log.status,
      message: log.message,
      synced_at: log.syncedAt,
      synced_by_name: log.syncedBy,
    },
    { onConflict: 'id' },
  );

  throwIfError(error, 'Gagal menyinkronkan log Google Sheet.');
}

async function fetchMenuItems(): Promise<MenuItem[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .order('category_name', { ascending: true })
    .order('name', { ascending: true });

  throwIfError(error, 'Gagal mengambil menu cloud.');

  return (data ?? []).map((row: DbRow) => ({
    id: toStringValue(row.id),
    name: toStringValue(row.name),
    category: toStringValue(row.category_name),
    price: toNumberValue(row.price),
    hpp: toNumberValue(row.hpp),
    isActive: Boolean(row.is_active),
  }));
}

async function fetchTransactions(): Promise<CompletedTransaction[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('*, transaction_items(*)')
    .order('transaction_at', { ascending: true });

  throwIfError(error, 'Gagal mengambil transaksi cloud.');

  return (data ?? []).map((row: DbRow) => {
    const items = toArray(row.transaction_items).map(mapTransactionItem);

    return {
      receiptNumber: toStringValue(row.receipt_number),
      dateTime: toStringValue(row.transaction_at),
      cashierName: toStringValue(row.cashier_name) || CASHIER_NAME,
      items,
      subtotalBeforeDiscount: toNumberValue(row.subtotal_before_discount),
      discountType: toDiscountType(row.discount_type),
      discountValue: toNumberValue(row.discount_value),
      discountAmount: toNumberValue(row.discount_amount),
      totalAfterDiscount: toNumberValue(row.total_after_discount),
      paymentMethod: toPaymentMethod(row.payment_method),
      paidAmount: toNullableNumberValue(row.paid_amount),
      changeAmount: toNullableNumberValue(row.change_amount),
    };
  });
}

async function fetchPendingOrders(): Promise<PendingOrder[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('pending_orders')
    .select('*, pending_order_items(*)')
    .order('created_at', { ascending: false });

  throwIfError(error, 'Gagal mengambil order tersimpan cloud.');

  return (data ?? []).map((row: DbRow) => ({
    id: toStringValue(row.id),
    label: toStringValue(row.label),
    createdAt: toStringValue(row.created_at),
    items: toArray(row.pending_order_items).map((itemRow) => ({
      id: toStringValue(itemRow.menu_item_id || itemRow.id),
      nameSnapshot: toStringValue(itemRow.menu_name_snapshot),
      categorySnapshot: toStringValue(itemRow.category_name_snapshot),
      unitPriceSnapshot: toNumberValue(itemRow.unit_price_snapshot),
      hppSnapshot: toNumberValue(itemRow.hpp_snapshot),
      quantity: Math.max(1, toNumberValue(itemRow.quantity)),
    })),
  }));
}

async function fetchReceiptCounter() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'receipt_counter')
    .maybeSingle();

  throwIfError(error, 'Gagal mengambil nomor struk cloud.');

  if (!data || !isRecord(data.value)) {
    return null;
  }

  return toNumberValue(data.value.receiptCounter);
}

async function fetchLegacyImports(): Promise<{
  batches: LegacyImportBatch[];
  sales: LegacySale[];
}> {
  if (!supabase) {
    return { batches: [], sales: [] };
  }

  const [{ data: batchData, error: batchError }, { data: salesData, error: salesError }] =
    await Promise.all([
      supabase
        .from('legacy_import_batches')
        .select('*')
        .order('imported_at', { ascending: false }),
      supabase
        .from('legacy_sales')
        .select('*')
        .order('sale_date', { ascending: true }),
    ]);

  throwIfError(batchError, 'Gagal mengambil riwayat import lama.');
  throwIfError(salesError, 'Gagal mengambil data import lama.');

  return {
    batches: (batchData ?? []).map((row: DbRow) => ({
      id: toStringValue(row.local_id) || toStringValue(row.id),
      fileName: toStringValue(row.file_name),
      importedAt: toStringValue(row.imported_at),
      importedBy: toStringValue(row.imported_by_name) || 'Santara User',
      totalRows: toNumberValue(row.total_rows),
      dateStart: toStringValue(row.date_start),
      dateEnd: toStringValue(row.date_end),
      totalGrossSales: toNumberValue(row.total_gross_sales),
      totalDiscount: toNumberValue(row.total_discount),
      totalNetSales: toNumberValue(row.total_net_sales),
      totalHpp: toNumberValue(row.total_hpp),
    })),
    sales: (salesData ?? []).map((row: DbRow) => ({
      id: toStringValue(row.local_id) || toStringValue(row.id),
      batchId: toStringValue(row.import_batch_id),
      saleDate: toStringValue(row.sale_date),
      menuName: toStringValue(row.menu_name),
      category: toStringValue(row.category_name) || 'Legacy',
      quantity: Math.max(1, toNumberValue(row.quantity)),
      grossSales: toNumberValue(row.gross_sales),
      discountAmount: toNumberValue(row.discount_amount),
      netSales: toNumberValue(row.net_sales),
      hppTotal: toNumberValue(row.hpp_total),
      paymentMethod: toStringValue(row.payment_method) || 'Legacy',
      notes: toStringValue(row.notes),
      source: 'legacy_import',
      importedAt: toStringValue(row.imported_at),
      importedBy: toStringValue(row.imported_by_name) || 'Santara User',
    })),
  };
}

async function fetchExpenses(): Promise<Expense[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false });

  throwIfError(error, 'Gagal mengambil pengeluaran cloud.');

  return (data ?? []).map((row: DbRow) => ({
    id: toStringValue(row.local_id) || toStringValue(row.id),
    date: toStringValue(row.expense_date),
    name: toStringValue(row.name),
    category: toStringValue(row.category),
    amount: toNumberValue(row.amount),
    paymentMethod: toExpensePaymentMethod(row.payment_method),
    notes: toStringValue(row.notes),
    createdAt: toStringValue(row.created_at),
    updatedAt: toStringValue(row.updated_at),
    createdBy: toStringValue(row.created_by_name) || 'Santara User',
  }));
}

async function fetchDailyClosings(): Promise<DailyClosing[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('daily_closings')
    .select('*')
    .order('closing_date', { ascending: false });

  throwIfError(error, 'Gagal mengambil closing harian cloud.');

  return (data ?? []).map((row: DbRow) => ({
    id: toStringValue(row.local_id) || toStringValue(row.id),
    closingDate: toStringValue(row.closing_date),
    cashierName: toStringValue(row.cashier_name),
    grossSales: toNumberValue(row.gross_sales),
    totalDiscount: toNumberValue(row.total_discount),
    netSales: toNumberValue(row.net_sales),
    totalHpp: toNumberValue(row.total_hpp),
    grossProfit: toSignedNumberValue(row.gross_profit),
    totalExpenses: toNumberValue(row.total_expenses),
    netProfit: toSignedNumberValue(row.net_profit),
    cashSales: toNumberValue(row.cash_sales),
    qrisSales: toNumberValue(row.qris_sales),
    debitSales: toNumberValue(row.debit_sales),
    expectedCash: toSignedNumberValue(row.expected_cash),
    actualCash: toSignedNumberValue(row.actual_cash),
    cashDifference: toSignedNumberValue(row.cash_difference),
    notes: toStringValue(row.notes),
    createdAt: toStringValue(row.created_at),
    updatedAt: toStringValue(row.updated_at),
    createdBy: toStringValue(row.created_by_name) || 'Santara User',
  }));
}

async function fetchGoogleSheetSettings(): Promise<GoogleSheetSyncSettings | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('google_sheet_sync_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  throwIfError(error, 'Gagal mengambil pengaturan Google Sheet cloud.');

  if (!data) {
    return null;
  }

  return {
    endpointUrl: toStringValue(data.endpoint_url),
    isEnabled: Boolean(data.is_enabled),
    updatedAt: toStringValue(data.updated_at) || null,
    updatedBy: toStringValue(data.updated_by_name) || 'Santara User',
  };
}

async function fetchGoogleSheetSyncLogs(): Promise<GoogleSheetSyncLog[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('google_sheet_sync_logs')
    .select('*')
    .order('synced_at', { ascending: false })
    .limit(20);

  throwIfError(error, 'Gagal mengambil log Google Sheet cloud.');

  return (data ?? []).map((row: DbRow) => ({
    id: toStringValue(row.local_id) || toStringValue(row.id),
    reportMode: toStringValue(row.report_mode),
    selectedDate: toStringValue(row.selected_date) || null,
    status: toStringValue(row.status) === 'success' ? 'success' : 'error',
    message: toStringValue(row.message),
    syncedAt: toStringValue(row.synced_at),
    syncedBy: toStringValue(row.synced_by_name) || 'Santara User',
  }));
}

function mapTransactionItem(row: DbRow): TransactionItem {
  return {
    id: toStringValue(row.menu_item_id || row.id),
    nameSnapshot: toStringValue(row.menu_name_snapshot),
    categorySnapshot: toStringValue(row.category_name_snapshot),
    unitPriceSnapshot: toNumberValue(row.unit_price_snapshot),
    hppSnapshot: toNumberValue(row.hpp_snapshot),
    quantity: Math.max(1, toNumberValue(row.quantity)),
    subtotal: toNumberValue(row.subtotal),
  };
}

function mergeTransactions(
  localTransactions: CompletedTransaction[],
  cloudTransactions: CompletedTransaction[],
) {
  const transactionMap = new Map<string, CompletedTransaction>();

  localTransactions.forEach((transaction) => {
    transactionMap.set(transaction.receiptNumber, transaction);
  });
  cloudTransactions.forEach((transaction) => {
    transactionMap.set(transaction.receiptNumber, transaction);
  });

  return Array.from(transactionMap.values()).sort(
    (first, second) =>
      new Date(first.dateTime).getTime() - new Date(second.dateTime).getTime(),
  );
}

function mergeLegacySales(localSales: LegacySale[], cloudSales: LegacySale[]) {
  const salesMap = new Map<string, LegacySale>();

  localSales.forEach((sale) => salesMap.set(sale.id, sale));
  cloudSales.forEach((sale) => salesMap.set(sale.id, sale));

  return Array.from(salesMap.values()).sort(
    (first, second) =>
      new Date(first.saleDate).getTime() - new Date(second.saleDate).getTime(),
  );
}

function mergeLegacyBatches(
  localBatches: LegacyImportBatch[],
  cloudBatches: LegacyImportBatch[],
) {
  const batchMap = new Map<string, LegacyImportBatch>();

  localBatches.forEach((batch) => batchMap.set(batch.id, batch));
  cloudBatches.forEach((batch) => batchMap.set(batch.id, batch));

  return Array.from(batchMap.values()).sort(
    (first, second) =>
      new Date(second.importedAt).getTime() - new Date(first.importedAt).getTime(),
  );
}

function mergeExpenses(localExpenses: Expense[], cloudExpenses: Expense[]) {
  const expenseMap = new Map<string, Expense>();

  localExpenses.forEach((expense) => expenseMap.set(expense.id, expense));
  cloudExpenses.forEach((expense) => expenseMap.set(expense.id, expense));

  return Array.from(expenseMap.values()).sort(
    (first, second) =>
      new Date(second.date).getTime() - new Date(first.date).getTime(),
  );
}

function mergeDailyClosings(
  localClosings: DailyClosing[],
  cloudClosings: DailyClosing[],
) {
  const closingMap = new Map<string, DailyClosing>();

  localClosings.forEach((closing) => closingMap.set(closing.id, closing));
  cloudClosings.forEach((closing) => closingMap.set(closing.id, closing));

  return Array.from(closingMap.values()).sort(
    (first, second) =>
      new Date(second.closingDate).getTime() -
      new Date(first.closingDate).getTime(),
  );
}

function mergeGoogleSheetSyncLogs(
  localLogs: GoogleSheetSyncLog[],
  cloudLogs: GoogleSheetSyncLog[],
) {
  const logMap = new Map<string, GoogleSheetSyncLog>();

  localLogs.forEach((log) => logMap.set(log.id, log));
  cloudLogs.forEach((log) => logMap.set(log.id, log));

  return Array.from(logMap.values())
    .sort(
      (first, second) =>
        new Date(second.syncedAt).getTime() - new Date(first.syncedAt).getTime(),
    )
    .slice(0, 30);
}

function getReceiptCounterFromTransactions(transactions: CompletedTransaction[]) {
  return transactions.reduce((maxCounter, transaction) => {
    const match = transaction.receiptNumber.match(/-(\d+)$/);
    const counter = match ? Number(match[1]) : 0;

    return Number.isFinite(counter) ? Math.max(maxCounter, counter) : maxCounter;
  }, 0);
}

function throwIfError(error: { message?: string } | null, fallbackMessage: string) {
  if (error) {
    throw new Error(error.message ?? fallbackMessage);
  }
}

function stableUuid(scope: string, value: string) {
  if (isUuid(value)) {
    return value.toLowerCase();
  }

  const input = `${scope}:${value}`;
  let hash1 = 0xdeadbeef;
  let hash2 = 0x41c6ce57;

  for (let index = 0; index < input.length; index += 1) {
    const charCode = input.charCodeAt(index);
    hash1 = Math.imul(hash1 ^ charCode, 2654435761);
    hash2 = Math.imul(hash2 ^ charCode, 1597334677);
  }

  hash1 = Math.imul(hash1 ^ (hash1 >>> 16), 2246822507);
  hash1 ^= Math.imul(hash2 ^ (hash2 >>> 13), 3266489909);
  hash2 = Math.imul(hash2 ^ (hash2 >>> 16), 2246822507);
  hash2 ^= Math.imul(hash1 ^ (hash1 >>> 13), 3266489909);

  const hex = `${toHex(hash1)}${toHex(hash2)}${toHex(hash1 ^ hash2)}${toHex(
    hash1 + hash2,
  )}`.padEnd(32, '0');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(
    17,
    20,
  )}-${hex.slice(20, 32)}`;
}

function toHex(value: number) {
  return (value >>> 0).toString(16).padStart(8, '0');
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function toStringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function toNumberValue(value: unknown) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
}

function toSignedNumberValue(value: unknown) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function toNullableNumberValue(value: unknown) {
  return value === null || value === undefined ? null : toNumberValue(value);
}

function toDiscountType(value: unknown): DiscountType {
  const text = toStringValue(value);

  return text === 'fixed' || text === 'percentage' ? text : 'none';
}

function toPaymentMethod(value: unknown): PaymentMethod {
  const text = toStringValue(value);

  return text === 'QRIS' || text === 'Debit' ? text : 'Cash';
}

function toExpensePaymentMethod(value: unknown): ExpensePaymentMethod {
  const text = toStringValue(value);

  if (
    text === 'QRIS' ||
    text === 'Debit' ||
    text === 'Transfer' ||
    text === 'Other'
  ) {
    return text;
  }

  return 'Cash';
}

function toArray(value: unknown): DbRow[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isRecord(value: unknown): value is DbRow {
  return typeof value === 'object' && value !== null;
}

import type {
  AppStateData,
  CartItem,
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

export const APP_STORAGE_KEY = 'santara-pos-v1';
export const APP_DATA_VERSION = 1;

type PersistedAppState = AppStateData & {
  version: typeof APP_DATA_VERSION;
  savedAt: string;
};

const paymentMethods: PaymentMethod[] = ['Cash', 'QRIS', 'Debit'];
const expensePaymentMethods: ExpensePaymentMethod[] = [
  'Cash',
  'QRIS',
  'Debit',
  'Transfer',
  'Other',
];
const discountTypes: DiscountType[] = ['none', 'fixed', 'percentage'];

export function createDefaultAppState(defaultMenuItems: MenuItem[]): AppStateData {
  return {
    menuItems: defaultMenuItems.map((item) => ({ ...item })),
    pendingOrders: [],
    completedTransactions: [],
    legacySales: [],
    legacyImportBatches: [],
    expenses: [],
    dailyClosings: [],
    googleSheetSyncSettings: createDefaultGoogleSheetSettings(),
    googleSheetSyncLogs: [],
    receiptCounter: 0,
  };
}

export function loadAppState(defaultMenuItems: MenuItem[]): AppStateData {
  if (!canUseLocalStorage()) {
    return createDefaultAppState(defaultMenuItems);
  }

  try {
    const savedValue = window.localStorage.getItem(APP_STORAGE_KEY);

    if (!savedValue) {
      return createDefaultAppState(defaultMenuItems);
    }

    return (
      normalizeAppState(JSON.parse(savedValue), defaultMenuItems) ??
      createDefaultAppState(defaultMenuItems)
    );
  } catch {
    return createDefaultAppState(defaultMenuItems);
  }
}

export function saveAppState(data: AppStateData) {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(toPersistedState(data)));
  } catch {
    // Local storage can fail in private mode or when quota is full. The app should keep running.
  }
}

export function exportAppState(data: AppStateData) {
  const payload = JSON.stringify(toPersistedState(data), null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `santara-pos-backup-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function parseImportedAppState(
  backupText: string,
  defaultMenuItems: MenuItem[],
): AppStateData | null {
  try {
    return normalizeAppState(JSON.parse(backupText), defaultMenuItems);
  } catch {
    return null;
  }
}

export function resetAppState() {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(APP_STORAGE_KEY);
}

function toPersistedState(data: AppStateData): PersistedAppState {
  return {
    ...data,
    version: APP_DATA_VERSION,
    savedAt: new Date().toISOString(),
  };
}

function normalizeAppState(
  value: unknown,
  defaultMenuItems: MenuItem[],
): AppStateData | null {
  if (!isRecord(value)) {
    return null;
  }

  const menuItems = normalizeMenuItems(value.menuItems);
  const pendingOrders = normalizePendingOrders(value.pendingOrders);
  const completedTransactions = normalizeCompletedTransactions(
    value.completedTransactions,
  );
  const legacySales = normalizeLegacySales(value.legacySales);
  const legacyImportBatches = normalizeLegacyImportBatches(
    value.legacyImportBatches,
  );
  const expenses = normalizeExpenses(value.expenses);
  const dailyClosings = normalizeDailyClosings(value.dailyClosings);
  const googleSheetSyncSettings = normalizeGoogleSheetSyncSettings(
    value.googleSheetSyncSettings,
  );
  const googleSheetSyncLogs = normalizeGoogleSheetSyncLogs(
    value.googleSheetSyncLogs,
  );
  const receiptCounter = normalizeReceiptCounter(value.receiptCounter);

  if (
    !menuItems ||
    !pendingOrders ||
    !completedTransactions ||
    !legacySales ||
    !legacyImportBatches ||
    !expenses ||
    !dailyClosings ||
    !googleSheetSyncSettings ||
    !googleSheetSyncLogs ||
    receiptCounter === null
  ) {
    return null;
  }

  return {
    menuItems: menuItems.length > 0 ? menuItems : defaultMenuItems,
    pendingOrders,
    completedTransactions,
    legacySales,
    legacyImportBatches,
    expenses,
    dailyClosings,
    googleSheetSyncSettings,
    googleSheetSyncLogs,
    receiptCounter,
  };
}

function normalizeMenuItems(value: unknown): MenuItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value.map(normalizeMenuItem);

  return items.every(Boolean) ? (items as MenuItem[]) : null;
}

function normalizeMenuItem(value: unknown): MenuItem | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isString(value.id) ||
    !isString(value.name) ||
    !isString(value.category) ||
    typeof value.isActive !== 'boolean'
  ) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    category: value.category,
    price: toNonNegativeNumber(value.price),
    hpp: toNonNegativeNumber(value.hpp),
    isActive: value.isActive,
  };
}

function normalizePendingOrders(value: unknown): PendingOrder[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const orders = value.map(normalizePendingOrder);

  return orders.every(Boolean) ? (orders as PendingOrder[]) : null;
}

function normalizePendingOrder(value: unknown): PendingOrder | null {
  if (!isRecord(value)) {
    return null;
  }

  const items = normalizeCartItems(value.items);

  if (
    !isString(value.id) ||
    !isString(value.label) ||
    !isString(value.createdAt) ||
    !items
  ) {
    return null;
  }

  return {
    id: value.id,
    label: value.label,
    items,
    createdAt: value.createdAt,
  };
}

function normalizeCompletedTransactions(value: unknown): CompletedTransaction[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const transactions = value.map(normalizeCompletedTransaction);

  return transactions.every(Boolean) ? (transactions as CompletedTransaction[]) : null;
}

function normalizeCompletedTransaction(value: unknown): CompletedTransaction | null {
  if (!isRecord(value)) {
    return null;
  }

  const items = normalizeTransactionItems(value.items);

  if (
    !isString(value.receiptNumber) ||
    !isString(value.dateTime) ||
    !isString(value.cashierName) ||
    !items ||
    !isDiscountType(value.discountType) ||
    !isPaymentMethod(value.paymentMethod)
  ) {
    return null;
  }

  return {
    receiptNumber: value.receiptNumber,
    dateTime: value.dateTime,
    cashierName: value.cashierName,
    items,
    subtotalBeforeDiscount: toNonNegativeNumber(value.subtotalBeforeDiscount),
    discountType: value.discountType,
    discountValue: toNonNegativeNumber(value.discountValue),
    discountAmount: toNonNegativeNumber(value.discountAmount),
    totalAfterDiscount: toNonNegativeNumber(value.totalAfterDiscount),
    paymentMethod: value.paymentMethod,
    paidAmount: toNullableNonNegativeNumber(value.paidAmount),
    changeAmount: toNullableNonNegativeNumber(value.changeAmount),
  };
}

function normalizeLegacySales(value: unknown): LegacySale[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const sales = value.map(normalizeLegacySale);

  return sales.every(Boolean) ? (sales as LegacySale[]) : null;
}

function normalizeLegacySale(value: unknown): LegacySale | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isString(value.id) ||
    !isString(value.batchId) ||
    !isString(value.saleDate) ||
    !isString(value.menuName)
  ) {
    return null;
  }

  return {
    id: value.id,
    batchId: value.batchId,
    saleDate: value.saleDate,
    menuName: value.menuName,
    category: isString(value.category) && value.category ? value.category : 'Legacy',
    quantity: Math.max(1, Math.floor(toNonNegativeNumber(value.quantity))),
    grossSales: toNonNegativeNumber(value.grossSales),
    discountAmount: toNonNegativeNumber(value.discountAmount),
    netSales: toNonNegativeNumber(value.netSales),
    hppTotal: toNonNegativeNumber(value.hppTotal),
    paymentMethod:
      isString(value.paymentMethod) && value.paymentMethod
        ? value.paymentMethod
        : 'Legacy',
    notes: isString(value.notes) ? value.notes : '',
    source: 'legacy_import',
    importedAt: isString(value.importedAt) ? value.importedAt : value.saleDate,
    importedBy: isString(value.importedBy) ? value.importedBy : 'Santara User',
  };
}

function normalizeLegacyImportBatches(value: unknown): LegacyImportBatch[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const batches = value.map(normalizeLegacyImportBatch);

  return batches.every(Boolean) ? (batches as LegacyImportBatch[]) : null;
}

function normalizeLegacyImportBatch(value: unknown): LegacyImportBatch | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isString(value.id) ||
    !isString(value.fileName) ||
    !isString(value.importedAt)
  ) {
    return null;
  }

  return {
    id: value.id,
    fileName: value.fileName,
    importedAt: value.importedAt,
    importedBy: isString(value.importedBy) ? value.importedBy : 'Santara User',
    totalRows: Math.max(0, Math.floor(toNonNegativeNumber(value.totalRows))),
    dateStart: isString(value.dateStart) ? value.dateStart : '',
    dateEnd: isString(value.dateEnd) ? value.dateEnd : '',
    totalGrossSales: toNonNegativeNumber(value.totalGrossSales),
    totalDiscount: toNonNegativeNumber(value.totalDiscount),
    totalNetSales: toNonNegativeNumber(value.totalNetSales),
    totalHpp: toNonNegativeNumber(value.totalHpp),
  };
}

function normalizeExpenses(value: unknown): Expense[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const expenses = value.map(normalizeExpense);

  return expenses.every(Boolean) ? (expenses as Expense[]) : null;
}

function normalizeExpense(value: unknown): Expense | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isString(value.id) ||
    !isString(value.date) ||
    !isString(value.name) ||
    !isString(value.category)
  ) {
    return null;
  }

  const createdAt = isString(value.createdAt) ? value.createdAt : value.date;

  return {
    id: value.id,
    date: value.date,
    name: value.name,
    category: value.category,
    amount: toNonNegativeNumber(value.amount),
    paymentMethod: isExpensePaymentMethod(value.paymentMethod)
      ? value.paymentMethod
      : 'Cash',
    notes: isString(value.notes) ? value.notes : '',
    createdAt,
    updatedAt: isString(value.updatedAt) ? value.updatedAt : createdAt,
    createdBy: isString(value.createdBy) ? value.createdBy : 'Santara User',
  };
}

function normalizeDailyClosings(value: unknown): DailyClosing[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const closings = value.map(normalizeDailyClosing);

  return closings.every(Boolean) ? (closings as DailyClosing[]) : null;
}

function normalizeDailyClosing(value: unknown): DailyClosing | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isString(value.id) ||
    !isString(value.closingDate) ||
    !isString(value.cashierName)
  ) {
    return null;
  }

  const createdAt = isString(value.createdAt) ? value.createdAt : value.closingDate;

  return {
    id: value.id,
    closingDate: value.closingDate,
    cashierName: value.cashierName,
    grossSales: toNonNegativeNumber(value.grossSales),
    totalDiscount: toNonNegativeNumber(value.totalDiscount),
    netSales: toNonNegativeNumber(value.netSales),
    totalHpp: toNonNegativeNumber(value.totalHpp),
    grossProfit: toNumber(value.grossProfit),
    totalExpenses: toNonNegativeNumber(value.totalExpenses),
    netProfit: toNumber(value.netProfit),
    cashSales: toNonNegativeNumber(value.cashSales),
    qrisSales: toNonNegativeNumber(value.qrisSales),
    debitSales: toNonNegativeNumber(value.debitSales),
    expectedCash: toNumber(value.expectedCash),
    actualCash: toNumber(value.actualCash),
    cashDifference: toNumber(value.cashDifference),
    notes: isString(value.notes) ? value.notes : '',
    createdAt,
    updatedAt: isString(value.updatedAt) ? value.updatedAt : createdAt,
    createdBy: isString(value.createdBy) ? value.createdBy : 'Santara User',
  };
}

function normalizeGoogleSheetSyncSettings(
  value: unknown,
): GoogleSheetSyncSettings | null {
  if (value === undefined) {
    return createDefaultGoogleSheetSettings();
  }

  if (!isRecord(value)) {
    return null;
  }

  return {
    endpointUrl: isString(value.endpointUrl) ? value.endpointUrl : '',
    isEnabled:
      typeof value.isEnabled === 'boolean'
        ? value.isEnabled
        : Boolean(isString(value.endpointUrl) && value.endpointUrl),
    updatedAt: isString(value.updatedAt) ? value.updatedAt : null,
    updatedBy: isString(value.updatedBy) ? value.updatedBy : 'Santara User',
  };
}

function normalizeGoogleSheetSyncLogs(value: unknown): GoogleSheetSyncLog[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const logs = value.map(normalizeGoogleSheetSyncLog);

  return logs.every(Boolean) ? (logs as GoogleSheetSyncLog[]) : null;
}

function normalizeGoogleSheetSyncLog(value: unknown): GoogleSheetSyncLog | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isString(value.id) ||
    !isString(value.reportMode) ||
    !isString(value.status) ||
    !isString(value.message) ||
    !isString(value.syncedAt)
  ) {
    return null;
  }

  return {
    id: value.id,
    reportMode: value.reportMode,
    selectedDate: isString(value.selectedDate) ? value.selectedDate : null,
    status: value.status === 'success' ? 'success' : 'error',
    message: value.message,
    syncedAt: value.syncedAt,
    syncedBy: isString(value.syncedBy) ? value.syncedBy : 'Santara User',
  };
}

function normalizeTransactionItems(value: unknown): TransactionItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value.map((item) => {
    const cartItem = normalizeCartItem(item);

    if (!cartItem || !isRecord(item)) {
      return null;
    }

    return {
      ...cartItem,
      subtotal: toNonNegativeNumber(item.subtotal),
    };
  });

  return items.every(Boolean) ? (items as TransactionItem[]) : null;
}

function normalizeCartItems(value: unknown): CartItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value.map(normalizeCartItem);

  return items.every(Boolean) ? (items as CartItem[]) : null;
}

function normalizeCartItem(value: unknown): CartItem | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isString(value.id) ||
    !isString(value.nameSnapshot) ||
    !isString(value.categorySnapshot)
  ) {
    return null;
  }

  return {
    id: value.id,
    nameSnapshot: value.nameSnapshot,
    categorySnapshot: value.categorySnapshot,
    unitPriceSnapshot: toNonNegativeNumber(value.unitPriceSnapshot),
    hppSnapshot: toNonNegativeNumber(value.hppSnapshot),
    quantity: Math.max(1, Math.floor(toNonNegativeNumber(value.quantity))),
  };
}

function normalizeReceiptCounter(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.floor(value);
}

function toNonNegativeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toNullableNonNegativeNumber(value: unknown) {
  if (value === null) {
    return null;
  }

  return toNonNegativeNumber(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return isString(value) && paymentMethods.includes(value as PaymentMethod);
}

function isExpensePaymentMethod(value: unknown): value is ExpensePaymentMethod {
  return (
    isString(value) &&
    expensePaymentMethods.includes(value as ExpensePaymentMethod)
  );
}

function isDiscountType(value: unknown): value is DiscountType {
  return isString(value) && discountTypes.includes(value as DiscountType);
}

function createDefaultGoogleSheetSettings(): GoogleSheetSyncSettings {
  return {
    endpointUrl: '',
    isEnabled: false,
    updatedAt: null,
    updatedBy: 'Santara User',
  };
}

function canUseLocalStorage() {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

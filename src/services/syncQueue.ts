import type {
  CompletedTransaction,
  DailyClosing,
  Expense,
  GoogleSheetSyncLog,
  GoogleSheetSyncSettings,
  LegacyImportBatch,
  LegacySale,
  MenuItem,
  PendingOrder,
} from '../types';

export type SyncOperationType =
  | 'menu-snapshot-upsert'
  | 'transaction-upsert'
  | 'pending-order-upsert'
  | 'pending-order-delete'
  | 'app-settings-upsert'
  | 'legacy-import-upsert'
  | 'expense-upsert'
  | 'expense-delete'
  | 'daily-closing-upsert'
  | 'google-sheet-settings-upsert'
  | 'google-sheet-sync-log-upsert';

export type SyncOperation = {
  id: string;
  type: SyncOperationType;
  dedupeKey: string;
  createdAt: string;
  payload:
    | { menuItems: MenuItem[] }
    | { transaction: CompletedTransaction }
    | { pendingOrder: PendingOrder }
    | { pendingOrderId: string }
    | { receiptCounter: number }
    | { batch: LegacyImportBatch; sales: LegacySale[] }
    | { expense: Expense }
    | { expenseId: string }
    | { dailyClosing: DailyClosing }
    | { googleSheetSyncSettings: GoogleSheetSyncSettings }
    | { googleSheetSyncLog: GoogleSheetSyncLog };
};

export type SyncMeta = {
  lastSyncedAt: string | null;
  lastError: string | null;
};

const SYNC_QUEUE_KEY = 'santara-pos-sync-queue-v1';
const SYNC_META_KEY = 'santara-pos-sync-meta-v1';

export function loadSyncQueue(): SyncOperation[] {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const savedValue = window.localStorage.getItem(SYNC_QUEUE_KEY);

    if (!savedValue) {
      return [];
    }

    const parsedValue = JSON.parse(savedValue);

    return Array.isArray(parsedValue)
      ? parsedValue.filter(isSyncOperation)
      : [];
  } catch {
    return [];
  }
}

export function saveSyncQueue(queue: SyncOperation[]) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export function addSyncOperation(
  queue: SyncOperation[],
  operation: Omit<SyncOperation, 'id' | 'createdAt'>,
) {
  const nextOperation: SyncOperation = {
    ...operation,
    id: `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
  const withoutDuplicate = queue.filter(
    (queuedOperation) => queuedOperation.dedupeKey !== operation.dedupeKey,
  );

  return [...withoutDuplicate, nextOperation];
}

export function removeSyncOperation(queue: SyncOperation[], operationId: string) {
  return queue.filter((operation) => operation.id !== operationId);
}

export function loadSyncMeta(): SyncMeta {
  if (!canUseLocalStorage()) {
    return {
      lastSyncedAt: null,
      lastError: null,
    };
  }

  try {
    const savedValue = window.localStorage.getItem(SYNC_META_KEY);

    if (!savedValue) {
      return {
        lastSyncedAt: null,
        lastError: null,
      };
    }

    const parsedValue = JSON.parse(savedValue);

    if (!isRecord(parsedValue)) {
      return {
        lastSyncedAt: null,
        lastError: null,
      };
    }

    return {
      lastSyncedAt:
        typeof parsedValue.lastSyncedAt === 'string'
          ? parsedValue.lastSyncedAt
          : null,
      lastError:
        typeof parsedValue.lastError === 'string'
          ? parsedValue.lastError
          : null,
    };
  } catch {
    return {
      lastSyncedAt: null,
      lastError: null,
    };
  }
}

export function saveSyncMeta(meta: SyncMeta) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
}

export function createMenuSyncOperation(
  menuItems: MenuItem[],
): Omit<SyncOperation, 'id' | 'createdAt'> {
  return {
    type: 'menu-snapshot-upsert',
    dedupeKey: 'menu:snapshot',
    payload: {
      menuItems,
    },
  };
}

export function createTransactionSyncOperations(
  transaction: CompletedTransaction,
  receiptCounter: number,
): Array<Omit<SyncOperation, 'id' | 'createdAt'>> {
  return [
    {
      type: 'transaction-upsert',
      dedupeKey: `transaction:${transaction.receiptNumber}`,
      payload: {
        transaction,
      },
    },
    {
      type: 'app-settings-upsert',
      dedupeKey: 'app-settings:receipt-counter',
      payload: {
        receiptCounter,
      },
    },
  ];
}

export function createPendingOrderUpsertOperation(
  pendingOrder: PendingOrder,
): Omit<SyncOperation, 'id' | 'createdAt'> {
  return {
    type: 'pending-order-upsert',
    dedupeKey: `pending-order:${pendingOrder.id}`,
    payload: {
      pendingOrder,
    },
  };
}

export function createPendingOrderDeleteOperation(
  pendingOrderId: string,
): Omit<SyncOperation, 'id' | 'createdAt'> {
  return {
    type: 'pending-order-delete',
    dedupeKey: `pending-order:${pendingOrderId}`,
    payload: {
      pendingOrderId,
    },
  };
}

export function createLegacyImportSyncOperation(
  batch: LegacyImportBatch,
  sales: LegacySale[],
): Omit<SyncOperation, 'id' | 'createdAt'> {
  return {
    type: 'legacy-import-upsert',
    dedupeKey: `legacy-import:${batch.id}`,
    payload: {
      batch,
      sales,
    },
  };
}

export function createExpenseUpsertOperation(
  expense: Expense,
): Omit<SyncOperation, 'id' | 'createdAt'> {
  return {
    type: 'expense-upsert',
    dedupeKey: `expense:${expense.id}`,
    payload: {
      expense,
    },
  };
}

export function createExpenseDeleteOperation(
  expenseId: string,
): Omit<SyncOperation, 'id' | 'createdAt'> {
  return {
    type: 'expense-delete',
    dedupeKey: `expense-delete:${expenseId}`,
    payload: {
      expenseId,
    },
  };
}

export function createDailyClosingSyncOperation(
  dailyClosing: DailyClosing,
): Omit<SyncOperation, 'id' | 'createdAt'> {
  return {
    type: 'daily-closing-upsert',
    dedupeKey: `daily-closing:${dailyClosing.closingDate}`,
    payload: {
      dailyClosing,
    },
  };
}

export function createGoogleSheetSettingsSyncOperation(
  googleSheetSyncSettings: GoogleSheetSyncSettings,
): Omit<SyncOperation, 'id' | 'createdAt'> {
  return {
    type: 'google-sheet-settings-upsert',
    dedupeKey: 'google-sheet:settings',
    payload: {
      googleSheetSyncSettings,
    },
  };
}

export function createGoogleSheetSyncLogOperation(
  googleSheetSyncLog: GoogleSheetSyncLog,
): Omit<SyncOperation, 'id' | 'createdAt'> {
  return {
    type: 'google-sheet-sync-log-upsert',
    dedupeKey: `google-sheet:log:${googleSheetSyncLog.id}`,
    payload: {
      googleSheetSyncLog,
    },
  };
}

function isSyncOperation(value: unknown): value is SyncOperation {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.dedupeKey === 'string' &&
    typeof value.createdAt === 'string' &&
    isRecord(value.payload)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function canUseLocalStorage() {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

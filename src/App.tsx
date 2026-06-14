import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckoutModal } from './components/CheckoutModal';
import { Expenses } from './components/Expenses';
import { ConfirmOrderModal, SaveOrderModal } from './components/HoldOrderModals';
import { LegacyImport } from './components/LegacyImport';
import { LoginScreen } from './components/LoginScreen';
import { MenuAdmin } from './components/MenuAdmin';
import { ReceiptHistory } from './components/ReceiptHistory';
import { ReceiptPreview } from './components/ReceiptPreview';
import { Reports } from './components/Reports';
import { menuCategories as initialMenuCategories } from './data/menu';
import {
  fetchUserProfile,
  getCurrentSession,
  onSupabaseAuthChange,
  signInToSupabase,
  signOutFromSupabase,
  type UserProfile,
  type UserRole,
} from './services/supabaseAuth';
import {
  canUseSupabase,
  pullCloudAppState,
  pushSyncOperation,
} from './services/supabaseData';
import {
  addSyncOperation,
  createDailyClosingSyncOperation,
  createExpenseDeleteOperation,
  createExpenseUpsertOperation,
  createGoogleSheetSettingsSyncOperation,
  createGoogleSheetSyncLogOperation,
  createLegacyImportSyncOperation,
  createMenuSyncOperation,
  createPendingOrderDeleteOperation,
  createPendingOrderUpsertOperation,
  createTransactionSyncOperations,
  loadSyncMeta,
  loadSyncQueue,
  removeSyncOperation,
  saveSyncMeta,
  saveSyncQueue,
  type SyncMeta,
  type SyncOperation,
} from './services/syncQueue';
import type {
  AppStateData,
  CartItem,
  CompletedTransaction,
  DailyClosing,
  Expense,
  GoogleSheetSyncLog,
  GoogleSheetSyncSettings,
  LegacyImportBatch,
  LegacySale,
  MenuItem,
  PendingOrder,
} from './types';
import {
  formatCompactDate,
  formatRupiah,
  formatShortTime,
} from './utils/format';
import {
  createDefaultAppState,
  loadAppState,
  saveAppState,
} from './utils/storage';

const CASHIER_NAME = 'Santara Cashier';
const defaultMenuItems = initialMenuCategories.flatMap((category) => category.items);

type AppTab =
  | 'cashier'
  | 'menu'
  | 'receipts'
  | 'reports'
  | 'expenses'
  | 'legacy';
type AuthStatus = 'loading' | 'local' | 'authenticated' | 'unauthenticated';

type PendingOrderAction = {
  type: 'resume' | 'delete';
  order: PendingOrder;
};

type SyncStatus =
  | 'local'
  | 'synced'
  | 'syncing'
  | 'pending'
  | 'error'
  | 'login-required';

const appTabs: Array<{ id: AppTab; label: string }> = [
  { id: 'cashier', label: 'Kasir' },
  { id: 'menu', label: 'Kelola Menu' },
  { id: 'receipts', label: 'Riwayat Struk' },
  { id: 'reports', label: 'Laporan' },
  { id: 'expenses', label: 'Pengeluaran' },
  { id: 'legacy', label: 'Import Data Lama' },
];

function createReceiptNumber(date: Date, sequence: number) {
  return `SAN-${formatCompactDate(date)}-${String(sequence).padStart(3, '0')}`;
}

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('cashier');
  const [initialAppData] = useState(() => loadAppState(defaultMenuItems));
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialAppData.menuItems);
  const [activeCategoryName, setActiveCategoryName] = useState(
    initialAppData.menuItems[0]?.category ?? initialMenuCategories[0].name,
  );
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [completedTransactions, setCompletedTransactions] = useState<
    CompletedTransaction[]
  >(initialAppData.completedTransactions);
  const [legacySales, setLegacySales] = useState<LegacySale[]>(
    initialAppData.legacySales,
  );
  const [legacyImportBatches, setLegacyImportBatches] = useState<
    LegacyImportBatch[]
  >(initialAppData.legacyImportBatches);
  const [expenses, setExpenses] = useState<Expense[]>(initialAppData.expenses);
  const [dailyClosings, setDailyClosings] = useState<DailyClosing[]>(
    initialAppData.dailyClosings,
  );
  const [googleSheetSyncSettings, setGoogleSheetSyncSettings] =
    useState<GoogleSheetSyncSettings>(initialAppData.googleSheetSyncSettings);
  const [googleSheetSyncLogs, setGoogleSheetSyncLogs] = useState<
    GoogleSheetSyncLog[]
  >(initialAppData.googleSheetSyncLogs);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>(
    initialAppData.pendingOrders,
  );
  const [receiptCounter, setReceiptCounter] = useState(initialAppData.receiptCounter);
  const [isSaveOrderOpen, setIsSaveOrderOpen] = useState(false);
  const [pendingOrderAction, setPendingOrderAction] =
    useState<PendingOrderAction | null>(null);
  const [syncQueue, setSyncQueue] = useState<SyncOperation[]>(loadSyncQueue);
  const [syncMeta, setSyncMeta] = useState<SyncMeta>(loadSyncMeta);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    canUseSupabase() ? 'login-required' : 'local',
  );
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    canUseSupabase() ? 'loading' : 'local',
  );
  const [authProfile, setAuthProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const isSyncingRef = useRef(false);

  const latestTransaction = completedTransactions[completedTransactions.length - 1];
  const effectiveRole: UserRole =
    authStatus === 'local' ? 'owner' : authProfile?.role ?? 'cashier';
  const visibleTabs = useMemo(
    () => appTabs.filter((tab) => canAccessTab(tab.id, effectiveRole)),
    [effectiveRole],
  );
  const categoryNames = useMemo(() => getCategoryNames(menuItems), [menuItems]);
  const activeCategoryNameSafe =
    categoryNames.includes(activeCategoryName) ? activeCategoryName : categoryNames[0];
  const activeMenuItems = menuItems.filter(
    (item) => item.category === activeCategoryNameSafe && item.isActive,
  );

  const subtotal = useMemo(() => getCartSubtotal(cart), [cart]);

  const totalQuantity = useMemo(() => getCartQuantity(cart), [cart]);

  const pendingOrderCount = useMemo(
    () => pendingOrders.reduce((total, order) => total + getCartQuantity(order.items), 0),
    [pendingOrders],
  );
  const appData = useMemo<AppStateData>(
    () => ({
      menuItems,
      pendingOrders,
      completedTransactions,
      legacySales,
      legacyImportBatches,
      expenses,
      dailyClosings,
      googleSheetSyncSettings,
      googleSheetSyncLogs,
      receiptCounter,
    }),
    [
      completedTransactions,
      dailyClosings,
      expenses,
      googleSheetSyncLogs,
      googleSheetSyncSettings,
      legacyImportBatches,
      legacySales,
      menuItems,
      pendingOrders,
      receiptCounter,
    ],
  );
  const appDataRef = useRef(appData);
  const syncQueueRef = useRef(syncQueue);
  const syncMetaRef = useRef(syncMeta);

  useEffect(() => {
    saveAppState(appData);
    appDataRef.current = appData;
  }, [appData]);

  useEffect(() => {
    syncQueueRef.current = syncQueue;
  }, [syncQueue]);

  useEffect(() => {
    syncMetaRef.current = syncMeta;
  }, [syncMeta]);

  const applyAuthSession = useCallback(async (session: Session | null) => {
    if (!canUseSupabase()) {
      setAuthStatus('local');
      setAuthProfile(null);
      setSyncStatus('local');
      return;
    }

    if (!session?.user) {
      setAuthStatus('unauthenticated');
      setAuthProfile(null);
      setSyncStatus('login-required');
      return;
    }

    const profile = await fetchUserProfile(session.user);

    setAuthProfile(profile);
    setAuthStatus('authenticated');
    setAuthError('');
  }, []);

  useEffect(() => {
    let isActive = true;

    if (!canUseSupabase()) {
      setAuthStatus('local');
      setSyncStatus('local');
      return () => undefined;
    }

    const loadSession = async () => {
      try {
        const session = await getCurrentSession();

        if (isActive) {
          await applyAuthSession(session);
        }
      } catch (error) {
        if (isActive) {
          setAuthStatus('unauthenticated');
          setAuthProfile(null);
          setSyncStatus('login-required');
          setAuthError(
            error instanceof Error
              ? error.message
              : 'Sesi login tidak bisa dibaca.',
          );
        }
      }
    };

    void loadSession();

    const unsubscribe = onSupabaseAuthChange((session) => {
      if (isActive) {
        void applyAuthSession(session);
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [applyAuthSession]);

  useEffect(() => {
    if (!canAccessTab(activeTab, effectiveRole)) {
      setActiveTab('cashier');
    }
  }, [activeTab, effectiveRole]);

  const replaceSyncQueue = useCallback((nextQueue: SyncOperation[]) => {
    syncQueueRef.current = nextQueue;
    saveSyncQueue(nextQueue);
    setSyncQueue(nextQueue);
  }, []);

  const updateSyncMeta = useCallback((nextMeta: SyncMeta) => {
    syncMetaRef.current = nextMeta;
    saveSyncMeta(nextMeta);
    setSyncMeta(nextMeta);
  }, []);

  const applyCloudAppData = useCallback((data: AppStateData) => {
    setMenuItems(data.menuItems);
    setPendingOrders(data.pendingOrders);
    setCompletedTransactions(data.completedTransactions);
    setLegacySales(data.legacySales);
    setLegacyImportBatches(data.legacyImportBatches);
    setExpenses(data.expenses);
    setDailyClosings(data.dailyClosings);
    setGoogleSheetSyncSettings(data.googleSheetSyncSettings);
    setGoogleSheetSyncLogs(data.googleSheetSyncLogs);
    setReceiptCounter(data.receiptCounter);
    setActiveCategoryName(data.menuItems[0]?.category ?? initialMenuCategories[0].name);
    saveAppState(data);
    appDataRef.current = data;
  }, []);

  const enqueueSyncOperations = useCallback(
    (operations: Array<Omit<SyncOperation, 'id' | 'createdAt'>>) => {
      setSyncQueue((currentQueue) => {
        const nextQueue = operations.reduce(
          (queue, operation) => addSyncOperation(queue, operation),
          currentQueue,
        );

        syncQueueRef.current = nextQueue;
        saveSyncQueue(nextQueue);

        return nextQueue;
      });
      setSyncStatus(
        canUseSupabase()
          ? authStatus === 'authenticated'
            ? 'pending'
            : 'login-required'
          : 'local',
      );
    },
    [authStatus],
  );

  const processSyncQueue = useCallback(
    async ({ pullAfterSuccess = true } = {}) => {
      if (!canUseSupabase()) {
        setSyncStatus('local');
        return;
      }

      if (authStatus !== 'authenticated') {
        setSyncStatus('login-required');
        return;
      }

      if (isSyncingRef.current) {
        return;
      }

      isSyncingRef.current = true;
      setSyncStatus('syncing');

      let remainingQueue = syncQueueRef.current;

      try {
        for (const operation of syncQueueRef.current) {
          await pushSyncOperation(operation);
          remainingQueue = removeSyncOperation(remainingQueue, operation.id);
          replaceSyncQueue(remainingQueue);
        }

        const nextMeta = {
          lastSyncedAt: new Date().toISOString(),
          lastError: null,
        };

        updateSyncMeta(nextMeta);

        if (pullAfterSuccess && remainingQueue.length === 0) {
          const cloudData = await pullCloudAppState(appDataRef.current);

          if (cloudData) {
            applyCloudAppData(cloudData);
          }
        }

        setSyncStatus(remainingQueue.length > 0 ? 'pending' : 'synced');
      } catch (error) {
        updateSyncMeta({
          lastSyncedAt: syncMetaRef.current.lastSyncedAt,
          lastError:
            error instanceof Error
              ? error.message
              : 'Sinkronisasi Supabase gagal.',
        });
        setSyncStatus('error');
      } finally {
        isSyncingRef.current = false;
      }
    },
    [applyCloudAppData, authStatus, replaceSyncQueue, updateSyncMeta],
  );

  useEffect(() => {
    if (authStatus === 'loading') {
      return;
    }

    void processSyncQueue({ pullAfterSuccess: true });
  }, [authStatus, processSyncQueue]);

  useEffect(() => {
    const handleOnline = () => {
      void processSyncQueue({ pullAfterSuccess: true });
    };

    window.addEventListener('online', handleOnline);

    return () => window.removeEventListener('online', handleOnline);
  }, [processSyncQueue]);

  useEffect(() => {
    if (
      syncQueue.length === 0 ||
      !canUseSupabase() ||
      authStatus !== 'authenticated' ||
      isSyncingRef.current
    ) {
      return;
    }

    const syncTimer = window.setTimeout(() => {
      void processSyncQueue({ pullAfterSuccess: false });
    }, 500);

    return () => window.clearTimeout(syncTimer);
  }, [authStatus, processSyncQueue, syncQueue]);

  const loginToSupabase = async (email: string, password: string) => {
    setAuthError('');
    setIsAuthSubmitting(true);

    try {
      await signInToSupabase(email, password);
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'Email atau password salah.',
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const logoutFromSupabase = async () => {
    setAuthError('');

    try {
      await signOutFromSupabase();
      setAuthProfile(null);
      setAuthStatus('unauthenticated');
      setSyncStatus('login-required');
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'Gagal keluar dari akun.',
      );
    }
  };

  const addMenuItem = (item: Omit<MenuItem, 'id'>) => {
    const id = `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    const nextItems = [...menuItems, { ...item, id }];

    setMenuItems(nextItems);
    enqueueSyncOperations([createMenuSyncOperation(nextItems)]);
    setActiveCategoryName(item.category);
  };

  const updateMenuItem = (id: string, updates: Partial<Omit<MenuItem, 'id'>>) => {
    const nextItems = menuItems.map((item) =>
      item.id === id ? { ...item, ...updates } : item,
    );

    setMenuItems(nextItems);
    enqueueSyncOperations([createMenuSyncOperation(nextItems)]);
  };

  const toggleMenuItem = (id: string) => {
    const nextItems = menuItems.map((item) =>
      item.id === id ? { ...item, isActive: !item.isActive } : item,
    );

    setMenuItems(nextItems);
    enqueueSyncOperations([createMenuSyncOperation(nextItems)]);
  };

  const addItem = (item: MenuItem) => {
    setCart((currentCart) => {
      const existingItem = currentCart.find((cartItem) => cartItem.id === item.id);

      if (existingItem) {
        return currentCart.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem,
        );
      }

      return [
        ...currentCart,
        {
          id: item.id,
          nameSnapshot: item.name,
          categorySnapshot: item.category,
          unitPriceSnapshot: item.price,
          hppSnapshot: item.hpp ?? 0,
          quantity: 1,
        },
      ];
    });
  };

  const increaseQuantity = (id: string) => {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    );
  };

  const decreaseQuantity = (id: string) => {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(item.quantity - 1, 0) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const removeItem = (id: string) => {
    setCart((currentCart) => currentCart.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const savePendingOrder = (label: string) => {
    if (cart.length === 0) {
      return;
    }

    const cleanLabel = label.trim();

    if (!cleanLabel) {
      return;
    }

    const pendingOrder: PendingOrder = {
      id: `pending-${Date.now()}`,
      label: cleanLabel,
      items: cart.map((item) => ({ ...item })),
      createdAt: new Date().toISOString(),
    };

    setPendingOrders((orders) => [pendingOrder, ...orders]);
    enqueueSyncOperations([createPendingOrderUpsertOperation(pendingOrder)]);
    setCart([]);
    setIsSaveOrderOpen(false);
  };

  const resumePendingOrder = (order: PendingOrder) => {
    setCart(order.items.map((item) => ({ ...item })));
    setPendingOrders((orders) =>
      orders.filter((pendingOrder) => pendingOrder.id !== order.id),
    );
    enqueueSyncOperations([createPendingOrderDeleteOperation(order.id)]);
    setPendingOrderAction(null);
  };

  const deletePendingOrder = (order: PendingOrder) => {
    setPendingOrders((orders) =>
      orders.filter((pendingOrder) => pendingOrder.id !== order.id),
    );
    enqueueSyncOperations([createPendingOrderDeleteOperation(order.id)]);
    setPendingOrderAction(null);
  };

  const requestResumePendingOrder = (order: PendingOrder) => {
    if (cart.length > 0) {
      setPendingOrderAction({ type: 'resume', order });
      return;
    }

    resumePendingOrder(order);
  };

  const completeCheckout = (
    checkout: Pick<
      CompletedTransaction,
      | 'discountType'
      | 'discountValue'
      | 'discountAmount'
      | 'totalAfterDiscount'
      | 'paymentMethod'
      | 'paidAmount'
      | 'changeAmount'
    >,
  ) => {
    const completedAt = new Date();
    const nextReceiptCounter = receiptCounter + 1;
    const transaction: CompletedTransaction = {
      receiptNumber: createReceiptNumber(completedAt, nextReceiptCounter),
      dateTime: completedAt.toISOString(),
      cashierName: CASHIER_NAME,
      items: cart.map((item) => ({
        ...item,
        hppSnapshot: item.hppSnapshot ?? 0,
        subtotal: item.unitPriceSnapshot * item.quantity,
      })),
      subtotalBeforeDiscount: subtotal,
      ...checkout,
    };

    setCompletedTransactions((transactions) => [...transactions, transaction]);
    setReceiptCounter(nextReceiptCounter);
    enqueueSyncOperations(
      createTransactionSyncOperations(transaction, nextReceiptCounter),
    );
    setCart([]);
    setIsCheckoutOpen(false);
  };

  const importLegacySales = (batch: LegacyImportBatch, sales: LegacySale[]) => {
    setLegacyImportBatches((batches) => [batch, ...batches]);
    setLegacySales((currentSales) => [...currentSales, ...sales]);
    enqueueSyncOperations([createLegacyImportSyncOperation(batch, sales)]);
  };

  const addExpense = (expense: Expense) => {
    setExpenses((currentExpenses) => [expense, ...currentExpenses]);
    enqueueSyncOperations([createExpenseUpsertOperation(expense)]);
  };

  const updateExpense = (expense: Expense) => {
    setExpenses((currentExpenses) =>
      currentExpenses.map((currentExpense) =>
        currentExpense.id === expense.id ? expense : currentExpense,
      ),
    );
    enqueueSyncOperations([createExpenseUpsertOperation(expense)]);
  };

  const deleteExpense = (expenseId: string) => {
    setExpenses((currentExpenses) =>
      currentExpenses.filter((expense) => expense.id !== expenseId),
    );
    enqueueSyncOperations([createExpenseDeleteOperation(expenseId)]);
  };

  const saveDailyClosing = (closing: DailyClosing) => {
    setDailyClosings((currentClosings) => {
      const existingClosing = currentClosings.some(
        (currentClosing) => currentClosing.closingDate === closing.closingDate,
      );

      if (existingClosing) {
        return currentClosings.map((currentClosing) =>
          currentClosing.closingDate === closing.closingDate
            ? closing
            : currentClosing,
        );
      }

      return [closing, ...currentClosings];
    });
    enqueueSyncOperations([createDailyClosingSyncOperation(closing)]);
  };

  const saveGoogleSheetSettings = (settings: GoogleSheetSyncSettings) => {
    setGoogleSheetSyncSettings(settings);
    enqueueSyncOperations([createGoogleSheetSettingsSyncOperation(settings)]);
  };

  const addGoogleSheetSyncLog = (log: GoogleSheetSyncLog) => {
    setGoogleSheetSyncLogs((currentLogs) => [log, ...currentLogs].slice(0, 50));
    enqueueSyncOperations([createGoogleSheetSyncLogOperation(log)]);
  };

  const importAppData = (data: AppStateData) => {
    setMenuItems(data.menuItems);
    setPendingOrders(data.pendingOrders);
    setCompletedTransactions(data.completedTransactions);
    setLegacySales(data.legacySales);
    setLegacyImportBatches(data.legacyImportBatches);
    setExpenses(data.expenses);
    setDailyClosings(data.dailyClosings);
    setGoogleSheetSyncSettings(data.googleSheetSyncSettings);
    setGoogleSheetSyncLogs(data.googleSheetSyncLogs);
    setReceiptCounter(data.receiptCounter);
    setCart([]);
    setIsCheckoutOpen(false);
    setIsSaveOrderOpen(false);
    setPendingOrderAction(null);
    setActiveCategoryName(data.menuItems[0]?.category ?? initialMenuCategories[0].name);
  };

  const resetLocalData = () => {
    const defaultState = createDefaultAppState(defaultMenuItems);

    importAppData(defaultState);
  };

  if (authStatus === 'loading' && canUseSupabase()) {
    return <LoadingScreen />;
  }

  if (authStatus === 'unauthenticated' && canUseSupabase()) {
    return (
      <LoginScreen
        errorMessage={authError}
        isLoading={isAuthSubmitting}
        onSubmit={loginToSupabase}
      />
    );
  }

  return (
    <main className="min-h-screen bg-santara-cream text-santara-roast lg:h-screen lg:overflow-hidden">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-3 py-3 sm:px-4 lg:h-screen lg:min-h-0 lg:px-5">
        <header className="flex shrink-0 flex-col gap-3 border-b border-santara-latte/80 pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-full bg-santara-bean text-base font-black text-white shadow-soft">
              SC
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-santara-clay">
                Santara POS
              </p>
              <h1 className="font-display text-2xl font-black leading-tight text-santara-roast sm:text-3xl">
                Santara Coffee
              </h1>
              <p className="mt-0.5 text-xs font-medium text-santara-roast/70 sm:text-sm">
                Ruang untuk cerita, jeda untuk jiwa
              </p>
              <SyncStatusIndicator
                lastSyncedAt={syncMeta.lastSyncedAt}
                onSyncNow={() => processSyncQueue({ pullAfterSuccess: true })}
                pendingCount={syncQueue.length}
                status={syncStatus}
              />
              <AuthSummary
                authProfile={authProfile}
                authStatus={authStatus}
                effectiveRole={effectiveRole}
                onLogout={logoutFromSupabase}
                roleMissing={Boolean(authProfile?.isMissing)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:w-[660px] xl:w-[720px]">
            <StatusTile label="Mode" value={getActiveTabLabel(activeTab)} />
            <StatusTile label="Cart" value={`${totalQuantity} item`} />
            <StatusTile label="Subtotal" value={formatRupiah(subtotal)} />
            <StatusTile label="Pending" value={`${pendingOrders.length} order`} />
            <StatusTile
              label="Last Receipt"
              value={latestTransaction?.receiptNumber ?? '-'}
            />
          </div>
        </header>

        <nav className="grid shrink-0 grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2 border-b border-santara-latte/70 py-3">
          {visibleTabs.map((tab) => (
            <TabButton
              isActive={activeTab === tab.id}
              key={tab.id}
              label={tab.label}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </nav>

        {activeTab === 'cashier' && (
          <CashierView
            activeCategoryName={activeCategoryNameSafe}
            activeMenuItems={activeMenuItems}
            cart={cart}
            categoryNames={categoryNames}
            clearCart={clearCart}
            decreaseQuantity={decreaseQuantity}
            increaseQuantity={increaseQuantity}
            latestTransaction={latestTransaction}
            onAddItem={addItem}
            onDeletePending={(order) =>
              setPendingOrderAction({ type: 'delete', order })
            }
            onOpenCheckout={() => setIsCheckoutOpen(true)}
            onOpenSaveOrder={() => setIsSaveOrderOpen(true)}
            onResumePending={requestResumePendingOrder}
            pendingOrderCount={pendingOrderCount}
            pendingOrders={pendingOrders}
            removeItem={removeItem}
            setActiveCategoryName={setActiveCategoryName}
            subtotal={subtotal}
            totalQuantity={totalQuantity}
          />
        )}

        {activeTab === 'menu' && canAccessTab('menu', effectiveRole) && (
          <MenuAdmin
            appData={appData}
            categories={categoryNames}
            defaultMenuItems={defaultMenuItems}
            items={menuItems}
            onAddItem={addMenuItem}
            onImportData={importAppData}
            onResetData={resetLocalData}
            onToggleItem={toggleMenuItem}
            onUpdateItem={updateMenuItem}
          />
        )}

        {activeTab === 'receipts' && (
          <ReceiptHistory transactions={completedTransactions} />
        )}

        {activeTab === 'reports' && canAccessTab('reports', effectiveRole) && (
          <Reports
            currentUserName={authProfile?.fullName ?? CASHIER_NAME}
            dailyClosings={dailyClosings}
            expenses={expenses}
            googleSheetSyncLogs={googleSheetSyncLogs}
            googleSheetSyncSettings={googleSheetSyncSettings}
            legacySales={legacySales}
            onAddGoogleSheetSyncLog={addGoogleSheetSyncLog}
            onSaveClosing={saveDailyClosing}
            onSaveGoogleSheetSettings={saveGoogleSheetSettings}
            transactions={completedTransactions}
          />
        )}

        {activeTab === 'expenses' && canAccessTab('expenses', effectiveRole) && (
          <Expenses
            currentUserName={authProfile?.fullName ?? CASHIER_NAME}
            expenses={expenses}
            onAddExpense={addExpense}
            onDeleteExpense={deleteExpense}
            onUpdateExpense={updateExpense}
          />
        )}

        {activeTab === 'legacy' && canAccessTab('legacy', effectiveRole) && (
          <LegacyImport
            batches={legacyImportBatches}
            importedBy={authProfile?.fullName ?? CASHIER_NAME}
            onSaveImport={importLegacySales}
          />
        )}
      </div>

      {isCheckoutOpen && (
        <CheckoutModal
          onClose={() => setIsCheckoutOpen(false)}
          onComplete={completeCheckout}
          subtotal={subtotal}
        />
      )}

      <SaveOrderModal
        isOpen={isSaveOrderOpen}
        onClose={() => setIsSaveOrderOpen(false)}
        onSave={savePendingOrder}
      />

      {pendingOrderAction && (
        <ConfirmOrderModal
          action={pendingOrderAction.type}
          onCancel={() => setPendingOrderAction(null)}
          onConfirm={() => {
            if (pendingOrderAction.type === 'resume') {
              resumePendingOrder(pendingOrderAction.order);
              return;
            }

            deletePendingOrder(pendingOrderAction.order);
          }}
          order={pendingOrderAction.order}
        />
      )}
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-santara-cream px-4 text-santara-roast">
      <section className="w-full max-w-sm rounded-xl bg-santara-foam p-5 text-center shadow-soft ring-1 ring-santara-latte">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-santara-bean text-base font-black text-white shadow-soft">
          SC
        </div>
        <h1 className="mt-3 text-xl font-black">Memeriksa sesi login...</h1>
        <p className="mt-2 text-sm font-medium text-santara-roast/65">
          Santara POS sedang menyiapkan akses cloud.
        </p>
      </section>
    </main>
  );
}

type AuthSummaryProps = {
  authProfile: UserProfile | null;
  authStatus: AuthStatus;
  effectiveRole: UserRole;
  onLogout: () => void;
  roleMissing: boolean;
};

function AuthSummary({
  authProfile,
  authStatus,
  effectiveRole,
  onLogout,
  roleMissing,
}: AuthSummaryProps) {
  if (authStatus === 'local') {
    return (
      <p className="mt-1 text-[11px] font-bold text-santara-roast/55">
        Mode lokal/demo: Supabase belum dikonfigurasi.
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-black">
      <span className="rounded-full bg-white px-2 py-1 text-santara-roast ring-1 ring-santara-latte">
        {authProfile?.fullName ?? 'Santara User'} - {getRoleLabel(effectiveRole)}
      </span>
      {roleMissing && (
        <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700 ring-1 ring-amber-200">
          Role belum dikonfigurasi
        </span>
      )}
      <button
        className="rounded-full bg-white px-2.5 py-1 text-santara-clay ring-1 ring-santara-latte transition hover:bg-santara-cream"
        onClick={onLogout}
        type="button"
      >
        Keluar
      </button>
    </div>
  );
}

type CashierViewProps = {
  activeCategoryName: string;
  activeMenuItems: MenuItem[];
  cart: CartItem[];
  categoryNames: string[];
  clearCart: () => void;
  decreaseQuantity: (id: string) => void;
  increaseQuantity: (id: string) => void;
  latestTransaction: CompletedTransaction | undefined;
  onAddItem: (item: MenuItem) => void;
  onDeletePending: (order: PendingOrder) => void;
  onOpenCheckout: () => void;
  onOpenSaveOrder: () => void;
  onResumePending: (order: PendingOrder) => void;
  pendingOrderCount: number;
  pendingOrders: PendingOrder[];
  removeItem: (id: string) => void;
  setActiveCategoryName: (category: string) => void;
  subtotal: number;
  totalQuantity: number;
};

function CashierView({
  activeCategoryName,
  activeMenuItems,
  cart,
  categoryNames,
  clearCart,
  decreaseQuantity,
  increaseQuantity,
  latestTransaction,
  onAddItem,
  onDeletePending,
  onOpenCheckout,
  onOpenSaveOrder,
  onResumePending,
  pendingOrderCount,
  pendingOrders,
  removeItem,
  setActiveCategoryName,
  subtotal,
  totalQuantity,
}: CashierViewProps) {
  return (
    <section className="grid flex-1 gap-3 py-3 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_430px]">
      <div className="flex min-h-[420px] flex-col overflow-hidden rounded-lg bg-santara-foam/80 p-3 shadow-soft ring-1 ring-santara-latte/70 sm:min-h-[480px] lg:min-h-0">
        <div className="flex shrink-0 flex-col gap-2 border-b border-santara-latte/70 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Menu</h2>
              <p className="text-xs text-santara-roast/65">
                Pilih kategori lalu tap menu untuk menambah pesanan.
              </p>
            </div>
            <p className="hidden rounded-full bg-white px-3 py-1 text-xs font-bold text-santara-bean ring-1 ring-santara-latte sm:block">
              {activeMenuItems.length} menu
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {categoryNames.map((category) => {
              const isActive = category === activeCategoryName;

              return (
                <button
                  className={`shrink-0 rounded-full px-4 py-3 text-sm font-black transition ${
                    isActive
                      ? 'bg-santara-bean text-white shadow-soft'
                      : 'bg-white text-santara-roast ring-1 ring-santara-latte hover:bg-santara-latte/40'
                  }`}
                  key={category}
                  onClick={() => setActiveCategoryName(category)}
                  type="button"
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid flex-1 auto-rows-[112px] grid-cols-[repeat(auto-fill,minmax(132px,1fr))] content-start gap-2.5 overflow-y-auto py-3 pr-1 sm:auto-rows-[124px] sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
          {activeMenuItems.length === 0 ? (
            <div className="col-span-full grid min-h-56 place-items-center rounded-lg border border-dashed border-santara-latte bg-white p-5 text-center">
              <p className="text-sm font-bold text-santara-roast/60">
                Tidak ada menu aktif di kategori ini.
              </p>
            </div>
          ) : (
            activeMenuItems.map((item) => (
              <button
                className="flex h-full flex-col justify-between rounded-lg bg-white p-3 text-left shadow-sm ring-1 ring-santara-latte transition hover:-translate-y-0.5 hover:bg-santara-cream focus:outline-none focus:ring-2 focus:ring-santara-clay"
                key={item.id}
                onClick={() => onAddItem(item)}
                type="button"
              >
                <span>
                  <span className="line-clamp-2 block text-sm font-black leading-tight text-santara-roast sm:text-[15px]">
                    {item.name}
                  </span>
                  <span className="mt-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-santara-sage">
                    {item.category}
                  </span>
                </span>
                <span className="mt-2 block text-base font-black text-santara-bean">
                  {formatRupiah(item.price)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <aside className="flex min-h-[440px] flex-col overflow-hidden rounded-lg bg-white shadow-soft ring-1 ring-santara-latte lg:min-h-0">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-santara-latte px-3 py-3">
          <div>
            <h2 className="text-lg font-black">Cart</h2>
            <p className="text-xs text-santara-roast/65">
              Review pesanan, beri diskon, lalu selesaikan pembayaran.
            </p>
          </div>
          <button
            className="rounded-full px-3 py-1.5 text-xs font-black text-santara-clay ring-1 ring-santara-latte transition hover:bg-santara-cream disabled:cursor-not-allowed disabled:opacity-40"
            disabled={cart.length === 0}
            onClick={clearCart}
            type="button"
          >
            Clear
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-3">
            {cart.length === 0 ? (
              <div className="grid min-h-36 place-items-center rounded-lg border border-dashed border-santara-latte bg-santara-cream/70 p-4 text-center">
                <div>
                  <p className="font-black">Cart masih kosong</p>
                  <p className="mt-1.5 text-xs text-santara-roast/65">
                    Tap menu favorit pelanggan untuk mulai membuat pesanan.
                  </p>
                  {latestTransaction && (
                    <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-santara-bean ring-1 ring-santara-latte">
                      Last completed: {latestTransaction.receiptNumber}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {cart.map((item) => (
                  <div
                    className="rounded-lg border border-santara-latte bg-santara-foam p-2.5"
                    key={item.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black leading-tight">
                          {item.nameSnapshot}
                        </p>
                        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-santara-sage">
                          {item.categorySnapshot}
                        </p>
                        <p className="mt-1 text-xs font-bold text-santara-bean">
                          {formatRupiah(item.unitPriceSnapshot)} / item
                        </p>
                      </div>
                      <button
                        aria-label={`Remove ${item.nameSnapshot}`}
                        className="rounded-full px-2.5 py-1 text-xs font-black text-santara-clay ring-1 ring-santara-latte transition hover:bg-white"
                        onClick={() => removeItem(item.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center rounded-full bg-white p-1 ring-1 ring-santara-latte">
                        <button
                          aria-label={`Decrease ${item.nameSnapshot}`}
                          className="grid size-8 place-items-center rounded-full text-lg font-black text-santara-bean transition hover:bg-santara-latte/60"
                          onClick={() => decreaseQuantity(item.id)}
                          type="button"
                        >
                          -
                        </button>
                        <span className="min-w-10 text-center text-base font-black">
                          {item.quantity}
                        </span>
                        <button
                          aria-label={`Increase ${item.nameSnapshot}`}
                          className="grid size-8 place-items-center rounded-full bg-santara-bean text-lg font-black text-white transition hover:bg-santara-roast"
                          onClick={() => increaseQuantity(item.id)}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-base font-black text-santara-roast">
                        {formatRupiah(item.unitPriceSnapshot * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <PendingOrdersSection
              onDelete={onDeletePending}
              onResume={onResumePending}
              orders={pendingOrders}
            />
          </div>

          {latestTransaction && (
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-black">Receipt Preview</h3>
                <button
                  className="rounded-full bg-santara-bean px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-santara-roast"
                  onClick={() => window.print()}
                  type="button"
                >
                  Print Receipt
                </button>
              </div>
              <ReceiptPreview transaction={latestTransaction} />
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-santara-latte bg-santara-cream/80 px-3 py-3">
          <div className="flex items-center justify-between text-xs font-bold text-santara-roast/70">
            <span>Total item</span>
            <span>{totalQuantity}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-base font-black">Subtotal</span>
            <span className="text-xl font-black text-santara-bean">
              {formatRupiah(subtotal)}
            </span>
          </div>
          <button
            className="mt-3 w-full rounded-lg bg-santara-bean px-5 py-3 text-base font-black text-white shadow-soft transition hover:bg-santara-roast disabled:cursor-not-allowed disabled:opacity-45"
            disabled={cart.length === 0}
            onClick={onOpenCheckout}
            type="button"
          >
            Checkout
          </button>
          {cart.length > 0 && (
            <button
              className="mt-2 w-full rounded-lg bg-white px-5 py-2.5 text-sm font-black text-santara-bean ring-1 ring-santara-latte transition hover:bg-santara-foam"
              onClick={onOpenSaveOrder}
              type="button"
            >
              Simpan Order
            </button>
          )}
          {pendingOrders.length > 0 && (
            <p className="mt-2 text-center text-[11px] font-bold text-santara-roast/55">
              {pendingOrders.length} order tersimpan, {pendingOrderCount} item
            </p>
          )}
        </div>
      </aside>
    </section>
  );
}

type PendingOrdersSectionProps = {
  orders: PendingOrder[];
  onResume: (order: PendingOrder) => void;
  onDelete: (order: PendingOrder) => void;
};

function PendingOrdersSection({
  orders,
  onResume,
  onDelete,
}: PendingOrdersSectionProps) {
  if (orders.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-santara-latte bg-white p-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black">Order Tersimpan</h3>
        <span className="rounded-full bg-santara-cream px-2 py-1 text-[11px] font-black text-santara-bean">
          {orders.length}
        </span>
      </div>

      <div className="mt-2 space-y-2">
        {orders.map((order) => (
          <article
            className="rounded-lg bg-santara-cream/80 p-2 ring-1 ring-santara-latte"
            key={order.id}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{order.label}</p>
                <p className="mt-0.5 text-[11px] font-bold text-santara-roast/60">
                  {getCartQuantity(order.items)} item -{' '}
                  {formatRupiah(getCartSubtotal(order.items))} -{' '}
                  {formatShortTime(order.createdAt)}
                </p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                className="rounded-md bg-santara-bean px-2 py-2 text-xs font-black text-white transition hover:bg-santara-roast"
                onClick={() => onResume(order)}
                type="button"
              >
                Lanjutkan Order
              </button>
              <button
                className="rounded-md bg-white px-2 py-2 text-xs font-black text-santara-clay ring-1 ring-santara-latte transition hover:bg-santara-foam"
                onClick={() => onDelete(order)}
                type="button"
              >
                Hapus Order
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

type SyncStatusIndicatorProps = {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  onSyncNow: () => void;
};

function SyncStatusIndicator({
  status,
  pendingCount,
  lastSyncedAt,
  onSyncNow,
}: SyncStatusIndicatorProps) {
  const label = getSyncStatusLabel(status);
  const dotClass = getSyncStatusDotClass(status);
  const detail =
    pendingCount > 0
      ? `${pendingCount} pending`
      : lastSyncedAt && status === 'synced'
        ? formatShortTime(lastSyncedAt)
        : '';

  return (
    <div className="mt-2 flex w-fit items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[11px] font-black text-santara-roast shadow-sm ring-1 ring-santara-latte">
      <span className={`size-2 rounded-full ${dotClass}`} aria-hidden="true" />
      <span>{label}</span>
      {detail && <span className="font-bold text-santara-roast/55">{detail}</span>}
      <button
        aria-label="Sync Sekarang"
        className="ml-0.5 grid size-6 place-items-center rounded-full text-sm font-black text-santara-bean transition hover:bg-santara-cream disabled:cursor-not-allowed disabled:opacity-45"
        disabled={status === 'syncing'}
        onClick={onSyncNow}
        title="Sync Sekarang"
        type="button"
      >
        ↻
      </button>
    </div>
  );
}

type StatusTileProps = {
  label: string;
  value: string;
};

function StatusTile({ label, value }: StatusTileProps) {
  return (
    <div className="min-h-[58px] rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-santara-latte">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-santara-sage">
        {label}
      </p>
      <p className="mt-0.5 truncate text-base font-black text-santara-roast">
        {value}
      </p>
    </div>
  );
}

type TabButtonProps = {
  isActive: boolean;
  label: string;
  onClick: () => void;
};

function TabButton({ isActive, label, onClick }: TabButtonProps) {
  return (
    <button
      className={`rounded-lg px-3 py-3 text-sm font-black transition ${
        isActive
          ? 'bg-santara-bean text-white shadow-soft'
          : 'bg-white text-santara-roast ring-1 ring-santara-latte hover:bg-santara-foam'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function getCartSubtotal(items: CartItem[]) {
  return items.reduce(
    (total, item) => total + item.unitPriceSnapshot * item.quantity,
    0,
  );
}

function getCartQuantity(items: CartItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function getCategoryNames(items: MenuItem[]) {
  return Array.from(new Set(items.map((item) => item.category).filter(Boolean)));
}

function getActiveTabLabel(tab: AppTab) {
  const labels: Record<AppTab, string> = {
    cashier: 'Kasir',
    menu: 'Kelola Menu',
    receipts: 'Riwayat Struk',
    reports: 'Laporan',
    expenses: 'Pengeluaran',
    legacy: 'Import Data Lama',
  };

  return labels[tab];
}

function canAccessTab(tab: AppTab, role: UserRole) {
  if (role === 'owner' || role === 'admin') {
    return true;
  }

  return tab === 'cashier' || tab === 'receipts';
}

function getRoleLabel(role: UserRole) {
  const labels: Record<UserRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    cashier: 'Cashier',
  };

  return labels[role];
}

function getSyncStatusLabel(status: SyncStatus) {
  const labels: Record<SyncStatus, string> = {
    local: 'Lokal',
    synced: 'Tersinkron',
    syncing: 'Menyinkronkan',
    pending: 'Menunggu',
    error: 'Error',
    'login-required': 'Login diperlukan',
  };

  return labels[status];
}

function getSyncStatusDotClass(status: SyncStatus) {
  const classes: Record<SyncStatus, string> = {
    local: 'bg-santara-sage',
    synced: 'bg-emerald-500',
    syncing: 'bg-santara-clay',
    pending: 'bg-amber-500',
    error: 'bg-red-500',
    'login-required': 'bg-amber-500',
  };

  return classes[status];
}

export default App;

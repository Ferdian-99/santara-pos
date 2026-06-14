import { useEffect, useMemo, useState } from 'react';
import { CheckoutModal } from './components/CheckoutModal';
import { ConfirmOrderModal, SaveOrderModal } from './components/HoldOrderModals';
import { MenuAdmin } from './components/MenuAdmin';
import { ReceiptHistory } from './components/ReceiptHistory';
import { ReceiptPreview } from './components/ReceiptPreview';
import { menuCategories as initialMenuCategories } from './data/menu';
import type {
  AppStateData,
  CartItem,
  CompletedTransaction,
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

type AppTab = 'cashier' | 'menu' | 'receipts';

type PendingOrderAction = {
  type: 'resume' | 'delete';
  order: PendingOrder;
};

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
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>(
    initialAppData.pendingOrders,
  );
  const [receiptCounter, setReceiptCounter] = useState(initialAppData.receiptCounter);
  const [isSaveOrderOpen, setIsSaveOrderOpen] = useState(false);
  const [pendingOrderAction, setPendingOrderAction] =
    useState<PendingOrderAction | null>(null);

  const latestTransaction = completedTransactions[completedTransactions.length - 1];
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
      receiptCounter,
    }),
    [completedTransactions, menuItems, pendingOrders, receiptCounter],
  );

  useEffect(() => {
    saveAppState(appData);
  }, [appData]);

  const addMenuItem = (item: Omit<MenuItem, 'id'>) => {
    const id = `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    setMenuItems((items) => [...items, { ...item, id }]);
    setActiveCategoryName(item.category);
  };

  const updateMenuItem = (id: string, updates: Partial<Omit<MenuItem, 'id'>>) => {
    setMenuItems((items) =>
      items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  const toggleMenuItem = (id: string) => {
    setMenuItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, isActive: !item.isActive } : item,
      ),
    );
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
    setCart([]);
    setIsSaveOrderOpen(false);
  };

  const resumePendingOrder = (order: PendingOrder) => {
    setCart(order.items.map((item) => ({ ...item })));
    setPendingOrders((orders) =>
      orders.filter((pendingOrder) => pendingOrder.id !== order.id),
    );
    setPendingOrderAction(null);
  };

  const deletePendingOrder = (order: PendingOrder) => {
    setPendingOrders((orders) =>
      orders.filter((pendingOrder) => pendingOrder.id !== order.id),
    );
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
    setCart([]);
    setIsCheckoutOpen(false);
  };

  const importAppData = (data: AppStateData) => {
    setMenuItems(data.menuItems);
    setPendingOrders(data.pendingOrders);
    setCompletedTransactions(data.completedTransactions);
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
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:w-[660px] xl:w-[720px]">
            <StatusTile label="Mode" value="Cashier" />
            <StatusTile label="Cart" value={`${totalQuantity} item`} />
            <StatusTile label="Subtotal" value={formatRupiah(subtotal)} />
            <StatusTile label="Pending" value={`${pendingOrders.length} order`} />
            <StatusTile
              label="Last Receipt"
              value={latestTransaction?.receiptNumber ?? '-'}
            />
          </div>
        </header>

        <nav className="grid shrink-0 grid-cols-3 gap-2 border-b border-santara-latte/70 py-3">
          <TabButton
            isActive={activeTab === 'cashier'}
            label="Kasir"
            onClick={() => setActiveTab('cashier')}
          />
          <TabButton
            isActive={activeTab === 'menu'}
            label="Kelola Menu"
            onClick={() => setActiveTab('menu')}
          />
          <TabButton
            isActive={activeTab === 'receipts'}
            label="Riwayat Struk"
            onClick={() => setActiveTab('receipts')}
          />
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

        {activeTab === 'menu' && (
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

export default App;

export type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  hpp: number;
  isActive: boolean;
};

export type MenuCategory = {
  id: string;
  name: string;
  items: MenuItem[];
};

export type CartItem = {
  id: string;
  nameSnapshot: string;
  categorySnapshot: string;
  unitPriceSnapshot: number;
  hppSnapshot: number;
  quantity: number;
};

export type TransactionItem = CartItem & {
  subtotal: number;
};

export type PaymentMethod = 'Cash' | 'QRIS' | 'Debit';
export type ReportPaymentMethod = PaymentMethod | 'Legacy' | string;

export type DiscountType = 'none' | 'fixed' | 'percentage';

export type CompletedTransaction = {
  receiptNumber: string;
  dateTime: string;
  cashierName: string;
  items: TransactionItem[];
  subtotalBeforeDiscount: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  totalAfterDiscount: number;
  paymentMethod: PaymentMethod;
  paidAmount: number | null;
  changeAmount: number | null;
};

export type PendingOrder = {
  id: string;
  label: string;
  items: CartItem[];
  createdAt: string;
};

export type LegacySale = {
  id: string;
  batchId: string;
  saleDate: string;
  menuName: string;
  category: string;
  quantity: number;
  grossSales: number;
  discountAmount: number;
  netSales: number;
  hppTotal: number;
  paymentMethod: ReportPaymentMethod;
  notes: string;
  source: 'legacy_import';
  importedAt: string;
  importedBy: string;
};

export type LegacyImportBatch = {
  id: string;
  fileName: string;
  importedAt: string;
  importedBy: string;
  totalRows: number;
  dateStart: string;
  dateEnd: string;
  totalGrossSales: number;
  totalDiscount: number;
  totalNetSales: number;
  totalHpp: number;
};

export type AppStateData = {
  menuItems: MenuItem[];
  pendingOrders: PendingOrder[];
  completedTransactions: CompletedTransaction[];
  legacySales: LegacySale[];
  legacyImportBatches: LegacyImportBatch[];
  receiptCounter: number;
};

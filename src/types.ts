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

export type AppStateData = {
  menuItems: MenuItem[];
  pendingOrders: PendingOrder[];
  completedTransactions: CompletedTransaction[];
  receiptCounter: number;
};

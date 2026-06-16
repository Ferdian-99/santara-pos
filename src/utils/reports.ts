import type {
  CompletedTransaction,
  DailyClosing,
  Expense,
  LegacySale,
  ReportPaymentMethod,
} from '../types';

export type ReportMode = 'today' | 'date' | 'month' | 'all';

export type PaymentSummary = {
  method: ReportPaymentMethod;
  transactionCount: number;
  total: number;
};

export type ExpenseSummary = {
  category: string;
  total: number;
};

export type MenuSalesSummary = {
  key: string;
  name: string;
  category: string;
  quantity: number;
  grossSales: number;
  discountAmount: number;
  netSales: number;
  unitHpp: number;
  totalHpp: number;
  hpp: number;
  estimatedProfit: number;
  profit: number;
  marginRatio: number;
  margin: number;
};

export type SalesReport = {
  transactions: CompletedTransaction[];
  legacySales: LegacySale[];
  expenses: Expense[];
  dailyClosing: DailyClosing | null;
  grossSales: number;
  totalDiscount: number;
  netSales: number;
  totalHpp: number;
  grossProfit: number;
  grossMargin: number;
  totalExpenses: number;
  netProfit: number;
  netMargin: number;
  totalTransactions: number;
  averageTransactionValue: number;
  paymentSummary: PaymentSummary[];
  expenseSummary: ExpenseSummary[];
  menuSales: MenuSalesSummary[];
  bestSellers: MenuSalesSummary[];
  discountedTransactionCount: number;
  averageDiscount: number;
  hasLegacyData: boolean;
  sourceTransactionCount: number;
  sourceLegacyCount: number;
};

const paymentMethods: ReportPaymentMethod[] = ['Cash', 'QRIS', 'Debit', 'Legacy'];

export function buildSalesReport(
  transactions: CompletedTransaction[],
  mode: ReportMode,
  selectedDate: string,
  legacySales: LegacySale[] = [],
  expenses: Expense[] = [],
  dailyClosings: DailyClosing[] = [],
): SalesReport {
  const filteredTransactions = filterTransactions(transactions, mode, selectedDate);
  const filteredLegacySales = filterLegacySales(legacySales, mode, selectedDate);
  const filteredExpenses = filterExpenses(expenses, mode, selectedDate);
  const dailyClosing = findDailyClosing(dailyClosings, mode, selectedDate);
  const transactionRecords = filteredTransactions.map(mapTransactionToReportRecord);
  const legacyRecords = filteredLegacySales.map(mapLegacySaleToReportRecord);
  const reportRecords = [...transactionRecords, ...legacyRecords];
  const grossSales = filteredTransactions.reduce(
    (total, transaction) => total + transaction.subtotalBeforeDiscount,
    0,
  ) + filteredLegacySales.reduce((total, sale) => total + sale.grossSales, 0);
  const totalDiscount = filteredTransactions.reduce(
    (total, transaction) => total + transaction.discountAmount,
    0,
  ) + filteredLegacySales.reduce((total, sale) => total + sale.discountAmount, 0);
  const netSales = Math.max(grossSales - totalDiscount, 0);
  const totalHpp = filteredTransactions.reduce(
    (total, transaction) => total + getTransactionHpp(transaction),
  0,
  ) + filteredLegacySales.reduce((total, sale) => total + sale.hppTotal, 0);
  const grossProfit = netSales - totalHpp;
  const grossMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
  const totalExpenses = filteredExpenses.reduce(
    (total, expense) => total + expense.amount,
    0,
  );
  const netProfit = grossProfit - totalExpenses;
  const netMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;
  const totalTransactions = reportRecords.length;
  const discountedTransactions = filteredTransactions.filter(
    (transaction) => transaction.discountAmount > 0,
  );
  const discountedLegacySales = filteredLegacySales.filter(
    (sale) => sale.discountAmount > 0,
  );

  return {
    transactions: filteredTransactions,
    legacySales: filteredLegacySales,
    expenses: filteredExpenses,
    dailyClosing,
    grossSales,
    totalDiscount,
    netSales,
    totalHpp,
    grossProfit,
    grossMargin,
    totalExpenses,
    netProfit,
    netMargin,
    totalTransactions,
    averageTransactionValue:
      totalTransactions > 0 ? netSales / totalTransactions : 0,
    paymentSummary: buildPaymentSummary(reportRecords),
    expenseSummary: buildExpenseSummary(filteredExpenses),
    menuSales: buildMenuSales(reportRecords),
    bestSellers: buildMenuSales(reportRecords)
      .sort((first, second) => second.quantity - first.quantity)
      .slice(0, 5),
    discountedTransactionCount:
      discountedTransactions.length + discountedLegacySales.length,
    averageDiscount:
      discountedTransactions.length + discountedLegacySales.length > 0
        ? totalDiscount /
          (discountedTransactions.length + discountedLegacySales.length)
        : 0,
    hasLegacyData: filteredLegacySales.length > 0,
    sourceTransactionCount: filteredTransactions.length,
    sourceLegacyCount: filteredLegacySales.length,
  };
}

export function getTodayInputValue() {
  return toInputDate(new Date());
}

function filterTransactions(
  transactions: CompletedTransaction[],
  mode: ReportMode,
  selectedDate: string,
) {
  if (mode === 'all') {
    return transactions;
  }

  const now = new Date();

  return transactions.filter((transaction) => {
    const transactionDate = new Date(transaction.dateTime);

    if (Number.isNaN(transactionDate.getTime())) {
      return false;
    }

    if (mode === 'today') {
      return toInputDate(transactionDate) === toInputDate(now);
    }

    if (mode === 'date') {
      return toInputDate(transactionDate) === selectedDate;
    }

    return (
      transactionDate.getFullYear() === now.getFullYear() &&
      transactionDate.getMonth() === now.getMonth()
    );
  });
}

function filterLegacySales(
  legacySales: LegacySale[],
  mode: ReportMode,
  selectedDate: string,
) {
  if (mode === 'all') {
    return legacySales;
  }

  const now = new Date();

  return legacySales.filter((sale) => {
    const saleDate = new Date(sale.saleDate);

    if (Number.isNaN(saleDate.getTime())) {
      return false;
    }

    if (mode === 'today') {
      return toInputDate(saleDate) === toInputDate(now);
    }

    if (mode === 'date') {
      return toInputDate(saleDate) === selectedDate;
    }

    return (
      saleDate.getFullYear() === now.getFullYear() &&
      saleDate.getMonth() === now.getMonth()
    );
  });
}

export function filterExpenses(
  expenses: Expense[],
  mode: ReportMode,
  selectedDate: string,
) {
  if (mode === 'all') {
    return expenses;
  }

  const now = new Date();

  return expenses.filter((expense) => {
    const expenseDate = new Date(expense.date);

    if (Number.isNaN(expenseDate.getTime())) {
      return false;
    }

    if (mode === 'today') {
      return toInputDate(expenseDate) === toInputDate(now);
    }

    if (mode === 'date') {
      return toInputDate(expenseDate) === selectedDate;
    }

    return (
      expenseDate.getFullYear() === now.getFullYear() &&
      expenseDate.getMonth() === now.getMonth()
    );
  });
}

function findDailyClosing(
  dailyClosings: DailyClosing[],
  mode: ReportMode,
  selectedDate: string,
) {
  if (mode === 'all' || mode === 'month') {
    return null;
  }

  const dateValue = mode === 'today' ? toInputDate(new Date()) : selectedDate;

  return (
    dailyClosings.find((closing) => closing.closingDate === dateValue) ?? null
  );
}

type ReportRecord = {
  dateTime: string;
  paymentMethod: ReportPaymentMethod;
  grossSales: number;
  discountAmount: number;
  netSales: number;
  hpp: number;
  items: Array<{
    key: string;
    name: string;
    category: string;
    quantity: number;
    grossSales: number;
    discountAmount: number;
    netSales: number;
    unitHpp: number;
    totalHpp: number;
    hpp: number;
  }>;
};

function buildPaymentSummary(records: ReportRecord[]): PaymentSummary[] {
  const methods = Array.from(
    new Set([...paymentMethods, ...records.map((record) => record.paymentMethod)]),
  );

  return paymentMethods.map((method) => {
    const matchingRecords = records.filter((record) => record.paymentMethod === method);

    return {
      method,
      transactionCount: matchingRecords.length,
      total: matchingRecords.reduce((sum, record) => sum + record.netSales, 0),
    };
  }).concat(
    methods
      .filter((method) => !paymentMethods.includes(method))
      .map((method) => {
        const matchingRecords = records.filter(
          (record) => record.paymentMethod === method,
        );

        return {
          method,
          transactionCount: matchingRecords.length,
          total: matchingRecords.reduce((sum, record) => sum + record.netSales, 0),
        };
      }),
  );
}

function buildExpenseSummary(expenses: Expense[]): ExpenseSummary[] {
  const expenseMap = new Map<string, number>();

  expenses.forEach((expense) => {
    expenseMap.set(
      expense.category,
      (expenseMap.get(expense.category) ?? 0) + expense.amount,
    );
  });

  return Array.from(expenseMap.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((first, second) => second.total - first.total);
}

function buildMenuSales(records: ReportRecord[]): MenuSalesSummary[] {
  const menuMap = new Map<string, MenuSalesSummary>();

  records.forEach((record) => {
    record.items.forEach((item) => {
      const totalHpp = safeNumber(item.totalHpp || item.hpp);
      const unitHpp =
        item.unitHpp > 0
          ? safeNumber(item.unitHpp)
          : item.quantity > 0
            ? totalHpp / item.quantity
            : 0;
      const profit = item.netSales - totalHpp;
      const marginRatio = item.netSales > 0 ? profit / item.netSales : 0;
      const margin = marginRatio * 100;
      const key = item.key;
      const current = menuMap.get(key);

      if (!current) {
        menuMap.set(key, {
          key,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          grossSales: item.grossSales,
          discountAmount: item.discountAmount,
          netSales: item.netSales,
          unitHpp,
          totalHpp,
          hpp: totalHpp,
          estimatedProfit: profit,
          profit,
          marginRatio,
          margin,
        });
        return;
      }

      current.quantity += item.quantity;
      current.grossSales += item.grossSales;
      current.discountAmount += item.discountAmount;
      current.netSales += item.netSales;
      current.totalHpp += totalHpp;
      current.hpp = current.totalHpp;
      current.unitHpp =
        current.quantity > 0 ? current.totalHpp / current.quantity : 0;
      current.estimatedProfit += profit;
      current.profit = current.estimatedProfit;
      current.marginRatio =
        current.netSales > 0 ? current.estimatedProfit / current.netSales : 0;
      current.margin = current.marginRatio * 100;
    });
  });

  return Array.from(menuMap.values()).sort(
    (first, second) =>
      second.quantity - first.quantity || second.netSales - first.netSales,
  );
}

function mapTransactionToReportRecord(transaction: CompletedTransaction): ReportRecord {
  const netSales = Math.max(
    transaction.subtotalBeforeDiscount - transaction.discountAmount,
    0,
  );

  return {
    dateTime: transaction.dateTime,
    paymentMethod: transaction.paymentMethod,
    grossSales: transaction.subtotalBeforeDiscount,
    discountAmount: transaction.discountAmount,
    netSales,
    hpp: getTransactionHpp(transaction),
    items: transaction.items.map((item) => {
      const grossSales = item.subtotal;
      const discountAmount = getDiscountAllocation(transaction, grossSales);
      const itemNetSales = Math.max(grossSales - discountAmount, 0);
      const unitHpp = safeNumber(item.hppSnapshot ?? 0);
      const totalHpp = unitHpp * item.quantity;

      return {
        key: `${item.nameSnapshot}|${item.categorySnapshot}`,
        name: item.nameSnapshot,
        category: item.categorySnapshot,
        quantity: item.quantity,
        grossSales,
        discountAmount,
        netSales: itemNetSales,
        unitHpp,
        totalHpp,
        hpp: totalHpp,
      };
    }),
  };
}

function mapLegacySaleToReportRecord(sale: LegacySale): ReportRecord {
  return {
    dateTime: sale.saleDate,
    paymentMethod: sale.paymentMethod || 'Legacy',
    grossSales: sale.grossSales,
    discountAmount: sale.discountAmount,
    netSales: sale.netSales,
    hpp: sale.hppTotal,
    items: [
      {
        key: `${sale.menuName}|${sale.category}`,
        name: sale.menuName,
        category: sale.category,
        quantity: sale.quantity,
        grossSales: sale.grossSales,
        discountAmount: sale.discountAmount,
        netSales: sale.netSales,
        unitHpp: sale.quantity > 0 ? sale.hppTotal / sale.quantity : 0,
        totalHpp: sale.hppTotal,
        hpp: sale.hppTotal,
      },
    ],
  };
}

function getTransactionHpp(transaction: CompletedTransaction) {
  return transaction.items.reduce(
    (total, item) => total + safeNumber(item.hppSnapshot ?? 0) * item.quantity,
    0,
  );
}

function safeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function getDiscountAllocation(
  transaction: CompletedTransaction,
  itemGrossSales: number,
) {
  if (transaction.discountAmount <= 0 || transaction.subtotalBeforeDiscount <= 0) {
    return 0;
  }

  return transaction.discountAmount * (itemGrossSales / transaction.subtotalBeforeDiscount);
}

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

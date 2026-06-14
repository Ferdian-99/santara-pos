import { useMemo, useState, type FormEvent } from 'react';
import type { Expense, ExpensePaymentMethod } from '../types';
import { formatRupiah } from '../utils/format';
import { getTodayInputValue, type ReportMode } from '../utils/reports';

type ExpensesProps = {
  expenses: Expense[];
  currentUserName: string;
  onAddExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => void;
  onUpdateExpense: (expense: Expense) => void;
};

const expenseCategories = [
  'Bahan Baku',
  'Susu',
  'Kopi',
  'Sirup',
  'Cup & Packaging',
  'Es Batu',
  'Gas',
  'Internet',
  'Operasional',
  'Lainnya',
];

const paymentMethods: ExpensePaymentMethod[] = [
  'Cash',
  'QRIS',
  'Debit',
  'Transfer',
  'Other',
];

const filterModes: { label: string; value: ReportMode }[] = [
  { label: 'Hari Ini', value: 'today' },
  { label: 'Pilih Tanggal', value: 'date' },
  { label: 'Bulan Ini', value: 'month' },
  { label: 'Semua Waktu', value: 'all' },
];

export function Expenses({
  currentUserName,
  expenses,
  onAddExpense,
  onDeleteExpense,
  onUpdateExpense,
}: ExpensesProps) {
  const [filterMode, setFilterMode] = useState<ReportMode>('today');
  const [selectedDate, setSelectedDate] = useState(getTodayInputValue);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const filteredExpenses = useMemo(
    () => filterExpenses(expenses, filterMode, selectedDate),
    [expenses, filterMode, selectedDate],
  );
  const totalExpense = filteredExpenses.reduce(
    (total, expense) => total + expense.amount,
    0,
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const now = new Date().toISOString();
    const baseExpense = editingExpense;
    const expense: Expense = {
      id: baseExpense?.id ?? `expense-${Date.now()}`,
      date: String(formData.get('date') ?? getTodayInputValue()),
      name: String(formData.get('name') ?? '').trim(),
      category: String(formData.get('category') ?? 'Lainnya'),
      amount: toPositiveNumber(formData.get('amount')),
      paymentMethod: toExpensePaymentMethod(formData.get('paymentMethod')),
      notes: String(formData.get('notes') ?? '').trim(),
      createdAt: baseExpense?.createdAt ?? now,
      updatedAt: now,
      createdBy: baseExpense?.createdBy ?? currentUserName,
    };

    if (!expense.name || expense.amount <= 0) {
      return;
    }

    if (baseExpense) {
      onUpdateExpense(expense);
      setEditingExpense(null);
    } else {
      onAddExpense(expense);
    }

    form.reset();
  };

  return (
    <section className="flex min-h-0 flex-col rounded-lg bg-santara-foam/80 p-3 shadow-soft ring-1 ring-santara-latte/70">
      <div className="flex shrink-0 flex-col gap-3 border-b border-santara-latte/70 pb-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-santara-clay">
            Pengeluaran
          </p>
          <h2 className="text-2xl font-black text-santara-roast">Pengeluaran</h2>
          <p className="mt-1 text-sm text-santara-roast/65">
            Catat biaya harian agar laporan laba bersih tetap akurat.
          </p>
        </div>

        <div className="rounded-lg bg-white px-4 py-3 ring-1 ring-santara-latte">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-santara-sage">
            Total Pengeluaran
          </p>
          <p className="mt-1 text-xl font-black text-santara-bean">
            {formatRupiah(totalExpense)}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-3">
        <form
          className="grid gap-2 rounded-lg bg-white p-3 ring-1 ring-santara-latte lg:grid-cols-[140px_1.2fr_170px_140px_150px_1fr_auto]"
          onSubmit={handleSubmit}
        >
          <Input
            defaultValue={editingExpense?.date ?? getTodayInputValue()}
            label="Tanggal"
            name="date"
            type="date"
          />
          <Input
            defaultValue={editingExpense?.name}
            label="Nama Pengeluaran"
            name="name"
            placeholder="Contoh: Susu fresh milk"
          />
          <Select
            defaultValue={editingExpense?.category ?? 'Bahan Baku'}
            label="Kategori"
            name="category"
            options={expenseCategories}
          />
          <Input
            defaultValue={editingExpense?.amount ? String(editingExpense.amount) : ''}
            label="Nominal"
            name="amount"
            placeholder="50000"
            type="number"
          />
          <Select
            defaultValue={editingExpense?.paymentMethod ?? 'Cash'}
            label="Metode Pembayaran"
            name="paymentMethod"
            options={paymentMethods}
          />
          <Input
            defaultValue={editingExpense?.notes}
            label="Catatan"
            name="notes"
            placeholder="Opsional"
          />
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            <button
              className="rounded-lg bg-santara-bean px-4 py-3 text-sm font-black text-white transition hover:bg-santara-roast"
              type="submit"
            >
              {editingExpense ? 'Simpan' : 'Tambah Pengeluaran'}
            </button>
            {editingExpense && (
              <button
                className="rounded-lg bg-white px-4 py-3 text-sm font-black text-santara-clay ring-1 ring-santara-latte transition hover:bg-santara-cream"
                onClick={() => setEditingExpense(null)}
                type="button"
              >
                Batal
              </button>
            )}
          </div>
        </form>

        <section className="mt-3 rounded-lg bg-white p-3 ring-1 ring-santara-latte">
          <div className="grid gap-2 md:grid-cols-[1fr_180px]">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {filterModes.map((mode) => (
                <button
                  className={`rounded-lg px-3 py-3 text-xs font-black transition ${
                    filterMode === mode.value
                      ? 'bg-santara-bean text-white shadow-soft'
                      : 'bg-white text-santara-roast ring-1 ring-santara-latte hover:bg-santara-cream'
                  }`}
                  key={mode.value}
                  onClick={() => setFilterMode(mode.value)}
                  type="button"
                >
                  {mode.label}
                </button>
              ))}
            </div>
            {filterMode === 'date' && (
              <input
                className="rounded-lg bg-white px-3 py-3 text-sm font-black text-santara-roast outline-none ring-1 ring-santara-latte transition focus:ring-2 focus:ring-santara-clay"
                onChange={(event) => setSelectedDate(event.target.value)}
                type="date"
                value={selectedDate}
              />
            )}
          </div>

          <div className="mt-3 space-y-2">
            {filteredExpenses.length === 0 ? (
              <p className="rounded-lg border border-dashed border-santara-latte bg-santara-cream/70 p-4 text-center text-sm font-bold text-santara-roast/55">
                Belum ada pengeluaran pada filter ini.
              </p>
            ) : (
              filteredExpenses.map((expense) => (
                <article
                  className="grid gap-2 rounded-lg bg-santara-cream/75 p-3 ring-1 ring-santara-latte lg:grid-cols-[120px_1.2fr_150px_130px_120px_auto]"
                  key={expense.id}
                >
                  <Meta label="Tanggal" value={expense.date} />
                  <Meta label="Nama Pengeluaran" value={expense.name} strong />
                  <Meta label="Kategori" value={expense.category} />
                  <Meta label="Nominal" value={formatRupiah(expense.amount)} />
                  <Meta label="Metode" value={expense.paymentMethod} />
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-lg bg-white px-3 py-2 text-xs font-black text-santara-bean ring-1 ring-santara-latte transition hover:bg-santara-foam"
                      onClick={() => setEditingExpense(expense)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-lg bg-white px-3 py-2 text-xs font-black text-santara-clay ring-1 ring-santara-latte transition hover:bg-santara-foam"
                      onClick={() => setDeletingExpense(expense)}
                      type="button"
                    >
                      Hapus
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      {deletingExpense && (
        <DeleteExpenseModal
          expense={deletingExpense}
          onCancel={() => setDeletingExpense(null)}
          onConfirm={() => {
            onDeleteExpense(deletingExpense.id);
            setDeletingExpense(null);
          }}
        />
      )}
    </section>
  );
}

type FieldProps = {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder?: string;
  type?: 'text' | 'date' | 'number';
};

function Input({
  defaultValue,
  label,
  name,
  placeholder,
  type = 'text',
}: FieldProps) {
  return (
    <label className="block min-w-0">
      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-santara-sage">
        {label}
      </span>
      <input
        className="mt-1 w-full rounded-lg bg-white px-3 py-2.5 text-sm font-bold text-santara-roast outline-none ring-1 ring-santara-latte transition placeholder:text-santara-roast/35 focus:ring-2 focus:ring-santara-clay"
        defaultValue={defaultValue}
        min={type === 'number' ? '0' : undefined}
        name={name}
        placeholder={placeholder}
        type={type}
      />
    </label>
  );
}

function Select({
  defaultValue,
  label,
  name,
  options,
}: FieldProps & { options: string[] }) {
  return (
    <label className="block min-w-0">
      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-santara-sage">
        {label}
      </span>
      <select
        className="mt-1 w-full rounded-lg bg-white px-3 py-2.5 text-sm font-bold text-santara-roast outline-none ring-1 ring-santara-latte transition focus:ring-2 focus:ring-santara-clay"
        defaultValue={defaultValue}
        name={name}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

type MetaProps = {
  label: string;
  value: string;
  strong?: boolean;
};

function Meta({ label, value, strong = false }: MetaProps) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-santara-sage">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-sm ${
          strong ? 'font-black text-santara-roast' : 'font-bold text-santara-roast/70'
        }`}
      >
        {value || '-'}
      </p>
    </div>
  );
}

type DeleteExpenseModalProps = {
  expense: Expense;
  onCancel: () => void;
  onConfirm: () => void;
};

function DeleteExpenseModal({
  expense,
  onCancel,
  onConfirm,
}: DeleteExpenseModalProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-santara-roast/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-santara-foam p-5 shadow-soft ring-1 ring-santara-latte">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-santara-clay">
          Pengeluaran
        </p>
        <h2 className="mt-1 text-2xl font-black text-santara-roast">
          Hapus pengeluaran?
        </h2>
        <p className="mt-3 text-sm font-medium leading-relaxed text-santara-roast/70">
          Pengeluaran <span className="font-black">{expense.name}</span> akan
          dihapus dari data lokal dan antrean sync.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            className="rounded-lg bg-white px-4 py-3 text-sm font-black text-santara-clay ring-1 ring-santara-latte transition hover:bg-santara-cream"
            onClick={onCancel}
            type="button"
          >
            Batal
          </button>
          <button
            className="rounded-lg bg-santara-bean px-4 py-3 text-sm font-black text-white shadow-soft transition hover:bg-santara-roast"
            onClick={onConfirm}
            type="button"
          >
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

function filterExpenses(
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

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function toPositiveNumber(value: FormDataEntryValue | null) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
}

function toExpensePaymentMethod(value: FormDataEntryValue | null): ExpensePaymentMethod {
  const text = String(value ?? '');

  return paymentMethods.includes(text as ExpensePaymentMethod)
    ? (text as ExpensePaymentMethod)
    : 'Cash';
}

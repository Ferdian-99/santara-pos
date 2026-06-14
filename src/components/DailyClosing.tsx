import { useMemo, useState, type FormEvent } from 'react';
import type { DailyClosing } from '../types';
import { formatRupiah } from '../utils/format';
import type { SalesReport } from '../utils/reports';

type DailyClosingProps = {
  cashierName: string;
  onSaveClosing: (closing: DailyClosing) => void;
  report: SalesReport;
  selectedDate: string;
};

export function DailyClosing({
  cashierName,
  onSaveClosing,
  report,
  selectedDate,
}: DailyClosingProps) {
  const existingClosing = report.dailyClosing;
  const [actualCash, setActualCash] = useState(
    existingClosing ? String(existingClosing.actualCash) : '',
  );
  const [notes, setNotes] = useState(existingClosing?.notes ?? '');
  const cashSales =
    report.paymentSummary.find((summary) => summary.method === 'Cash')?.total ?? 0;
  const qrisSales =
    report.paymentSummary.find((summary) => summary.method === 'QRIS')?.total ?? 0;
  const debitSales =
    report.paymentSummary.find((summary) => summary.method === 'Debit')?.total ?? 0;
  const cashExpenses = report.expenses
    .filter((expense) => expense.paymentMethod === 'Cash')
    .reduce((total, expense) => total + expense.amount, 0);
  const expectedCash = cashSales - cashExpenses;
  const actualCashValue = Number(actualCash);
  const safeActualCash = Number.isFinite(actualCashValue) ? actualCashValue : 0;
  const cashDifference = safeActualCash - expectedCash;
  const isDateClosingAvailable = Boolean(selectedDate);
  const closingSummary = useMemo(
    () => [
      ['Penjualan Kotor', report.grossSales],
      ['Total Diskon', report.totalDiscount],
      ['Penjualan Bersih', report.netSales],
      ['Total HPP', report.totalHpp],
      ['Laba Kotor', report.grossProfit],
      ['Total Pengeluaran', report.totalExpenses],
      ['Laba Bersih', report.netProfit],
      ['Cash', cashSales],
      ['QRIS', qrisSales],
      ['Debit', debitSales],
      ['Kas Seharusnya', expectedCash],
    ],
    [cashSales, debitSales, expectedCash, qrisSales, report],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isDateClosingAvailable) {
      return;
    }

    const now = new Date().toISOString();
    const closing: DailyClosing = {
      id: existingClosing?.id ?? `closing-${selectedDate}`,
      closingDate: selectedDate,
      cashierName,
      grossSales: report.grossSales,
      totalDiscount: report.totalDiscount,
      netSales: report.netSales,
      totalHpp: report.totalHpp,
      grossProfit: report.grossProfit,
      totalExpenses: report.totalExpenses,
      netProfit: report.netProfit,
      cashSales,
      qrisSales,
      debitSales,
      expectedCash,
      actualCash: safeActualCash,
      cashDifference,
      notes,
      createdAt: existingClosing?.createdAt ?? now,
      updatedAt: now,
      createdBy: existingClosing?.createdBy ?? cashierName,
    };

    onSaveClosing(closing);
  };

  return (
    <section className="rounded-lg bg-white p-3 ring-1 ring-santara-latte">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-santara-clay">
          Closing Harian
        </p>
        <h3 className="text-lg font-black text-santara-roast">Closing Harian</h3>
        <p className="text-sm text-santara-roast/65">
          Gunakan `Hari Ini` atau `Pilih Tanggal` untuk menyimpan closing harian.
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {closingSummary.map(([label, value]) => (
          <div
            className="rounded-lg bg-santara-cream/75 px-3 py-2 ring-1 ring-santara-latte"
            key={label}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-santara-sage">
              {label}
            </p>
            <p className="mt-1 text-sm font-black text-santara-roast">
              {formatRupiah(Number(value))}
            </p>
          </div>
        ))}
      </div>

      <form
        className="mt-3 grid gap-2 md:grid-cols-[160px_1fr_auto]"
        onSubmit={handleSubmit}
      >
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-santara-sage">
            Kas Aktual
          </span>
          <input
            className="mt-1 w-full rounded-lg bg-white px-3 py-3 text-sm font-bold text-santara-roast outline-none ring-1 ring-santara-latte transition focus:ring-2 focus:ring-santara-clay"
            min="0"
            onChange={(event) => setActualCash(event.target.value)}
            placeholder="0"
            type="number"
            value={actualCash}
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-santara-sage">
            Catatan
          </span>
          <input
            className="mt-1 w-full rounded-lg bg-white px-3 py-3 text-sm font-bold text-santara-roast outline-none ring-1 ring-santara-latte transition focus:ring-2 focus:ring-santara-clay"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Catatan closing"
            value={notes}
          />
        </label>
        <div className="grid gap-2">
          <div className="rounded-lg bg-santara-cream px-3 py-2 ring-1 ring-santara-latte">
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-santara-sage">
              Selisih Kas
            </p>
            <p className="text-sm font-black text-santara-roast">
              {formatRupiah(cashDifference)}
            </p>
          </div>
          <button
            className="rounded-lg bg-santara-bean px-4 py-3 text-sm font-black text-white transition hover:bg-santara-roast disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!isDateClosingAvailable}
            type="submit"
          >
            Simpan Closing
          </button>
        </div>
      </form>
    </section>
  );
}

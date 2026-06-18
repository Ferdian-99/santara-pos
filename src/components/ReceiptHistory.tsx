import { useMemo, useState } from 'react';
import { ReceiptPreview } from './ReceiptPreview';
import type { CompletedTransaction, PaymentMethod } from '../types';
import { formatReceiptDate, formatRupiah } from '../utils/format';

type ReceiptHistoryProps = {
  canVoid: boolean;
  currentUserName: string;
  onVoidReceipt: (receiptNumber: string, reason: string) => void;
  transactions: CompletedTransaction[];
};

type PaymentFilter = 'Semua' | PaymentMethod;

const paymentFilters: PaymentFilter[] = ['Semua', 'Cash', 'QRIS', 'Debit'];

export function ReceiptHistory({
  canVoid,
  currentUserName,
  onVoidReceipt,
  transactions,
}: ReceiptHistoryProps) {
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('Semua');
  const [voidTarget, setVoidTarget] = useState<CompletedTransaction | null>(null);
  const [selectedReceiptNumber, setSelectedReceiptNumber] = useState<string | null>(
    transactions[transactions.length - 1]?.receiptNumber ?? null,
  );

  const todayKey = new Date().toDateString();
  const todayTransactions = transactions.filter(
    (transaction) =>
      transaction.status !== 'voided' &&
      new Date(transaction.dateTime).toDateString() === todayKey,
  );
  const totalSalesToday = todayTransactions.reduce(
    (total, transaction) => total + transaction.totalAfterDiscount,
    0,
  );

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        const matchesSearch = transaction.receiptNumber
          .toLowerCase()
          .includes(search.toLowerCase().trim());
        const matchesPayment =
          paymentFilter === 'Semua' || transaction.paymentMethod === paymentFilter;

        return matchesSearch && matchesPayment;
      }),
    [paymentFilter, search, transactions],
  );

  const selectedTransaction =
    transactions.find(
      (transaction) => transaction.receiptNumber === selectedReceiptNumber,
    ) ??
    filteredTransactions[0] ??
    null;
  const selectedSummary = selectedTransaction
    ? getTransactionSummary(selectedTransaction)
    : null;

  return (
    <section className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_410px]">
      <div className="flex min-h-0 flex-col rounded-lg bg-santara-foam/80 p-3 shadow-soft ring-1 ring-santara-latte/70">
        <div className="border-b border-santara-latte/70 pb-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-santara-clay">
            Operasional
          </p>
          <h2 className="text-2xl font-black text-santara-roast">Riwayat Struk</h2>
          <p className="text-sm text-santara-roast/65">
            Struk dari sesi aplikasi saat ini untuk cek ulang dan reprint.
          </p>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <HistoryCard label="Total struk hari ini" value={String(todayTransactions.length)} />
          <HistoryCard
            label="Total penjualan hari ini"
            value={formatRupiah(totalSalesToday)}
          />
          <HistoryCard
            label="Total struk tersimpan di sesi ini"
            value={String(transactions.length)}
          />
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_280px]">
          <input
            className="rounded-lg bg-white px-4 py-3 text-sm font-bold text-santara-roast outline-none ring-1 ring-santara-latte transition placeholder:text-santara-roast/35 focus:ring-2 focus:ring-santara-clay"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nomor struk"
            type="search"
            value={search}
          />
          <div className="grid grid-cols-4 gap-2">
            {paymentFilters.map((filter) => (
              <button
                className={`rounded-lg px-3 py-3 text-xs font-black transition ${
                  paymentFilter === filter
                    ? 'bg-santara-bean text-white'
                    : 'bg-white text-santara-roast ring-1 ring-santara-latte'
                }`}
                key={filter}
                onClick={() => setPaymentFilter(filter)}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          {filteredTransactions.length === 0 ? (
            <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-santara-latte bg-santara-cream/70 p-5 text-center">
              <div>
                <p className="font-black">Belum ada struk</p>
                <p className="mt-1 text-sm text-santara-roast/65">
                  Selesaikan transaksi di tab Kasir untuk melihat riwayat struk.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.map((transaction) => (
                <button
                  className={`w-full rounded-lg p-3 text-left ring-1 transition ${
                    selectedTransaction?.receiptNumber === transaction.receiptNumber
                      ? 'bg-santara-bean text-white ring-santara-bean'
                      : 'bg-white text-santara-roast ring-santara-latte hover:bg-santara-cream'
                  }`}
                  key={transaction.receiptNumber}
                  onClick={() => setSelectedReceiptNumber(transaction.receiptNumber)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{transaction.receiptNumber}</p>
                      {transaction.status === 'voided' && (
                        <span className="mt-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-700 ring-1 ring-red-100">
                          Dibatalkan
                        </span>
                      )}
                      <p className="mt-1 text-xs font-bold opacity-75">
                        {formatReceiptDate(transaction.dateTime)} -{' '}
                        {transaction.cashierName}
                      </p>
                    </div>
                    <p className="text-right text-sm font-black">
                      {formatRupiah(transaction.totalAfterDiscount)}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold opacity-80">
                    <span>{transaction.paymentMethod}</span>
                    <span>{getTransactionQuantity(transaction)} item</span>
                    {transaction.discountAmount > 0 && (
                      <span>Diskon {formatRupiah(transaction.discountAmount)}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <aside className="flex min-h-[420px] flex-col overflow-hidden rounded-lg bg-white shadow-soft ring-1 ring-santara-latte lg:min-h-0">
        <div className="flex items-center justify-between gap-3 border-b border-santara-latte px-3 py-3">
          <div>
            <h3 className="font-black">Detail Struk</h3>
            <p className="text-xs text-santara-roast/60">
              Buka detail dan reprint struk.
            </p>
          </div>
          <div className="flex gap-2">
            {canVoid && selectedTransaction?.status !== 'voided' && (
              <button
                className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-santara-clay ring-1 ring-santara-latte transition hover:bg-santara-cream"
                disabled={!selectedTransaction}
                onClick={() => setVoidTarget(selectedTransaction)}
                type="button"
              >
                Batalkan
              </button>
            )}
            <button
              className="rounded-full bg-santara-bean px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-santara-roast disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!selectedTransaction}
              onClick={() => window.print()}
              type="button"
            >
              Reprint
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {selectedTransaction ? (
            <div className="space-y-3">
              <section className="rounded-lg bg-santara-cream p-3 ring-1 ring-santara-latte">
                <h4 className="text-sm font-black">Detail Transaksi</h4>
                <div className="mt-3 space-y-2 text-sm font-bold">
                  <DetailRow
                    label="Nomor Struk"
                    value={selectedTransaction.receiptNumber}
                  />
                  <DetailRow
                    label="Waktu"
                    value={formatReceiptDate(selectedTransaction.dateTime)}
                  />
                  <DetailRow label="Kasir" value={selectedTransaction.cashierName} />
                  <DetailRow
                    label="Status"
                    value={
                      selectedTransaction.status === 'voided'
                        ? 'Struk Dibatalkan'
                        : 'Selesai'
                    }
                  />
                  {selectedTransaction.status === 'voided' && (
                    <>
                      <DetailRow
                        label="Alasan pembatalan"
                        value={selectedTransaction.voidReason ?? '-'}
                      />
                      <DetailRow
                        label="Dibatalkan oleh"
                        value={selectedTransaction.voidedBy ?? '-'}
                      />
                      <DetailRow
                        label="Waktu batal"
                        value={
                          selectedTransaction.voidedAt
                            ? formatReceiptDate(selectedTransaction.voidedAt)
                            : '-'
                        }
                      />
                    </>
                  )}
                  <DetailRow
                    label="Metode Pembayaran"
                    value={selectedTransaction.paymentMethod}
                  />
                  <DetailRow
                    label="Subtotal"
                    value={formatRupiah(selectedTransaction.subtotalBeforeDiscount)}
                  />
                  {selectedTransaction.discountAmount > 0 ? (
                    <>
                      <DetailRow
                        label="Diskon"
                        value={formatDiscountLabel(selectedTransaction)}
                      />
                      <DetailRow
                        label="Nominal Diskon"
                        value={`-${formatRupiah(selectedTransaction.discountAmount)}`}
                      />
                    </>
                  ) : (
                    <DetailRow label="Diskon" value="Tidak ada diskon" />
                  )}
                  <DetailRow
                    label="Total"
                    strong
                    value={formatRupiah(selectedTransaction.totalAfterDiscount)}
                  />
                  {selectedTransaction.paymentMethod === 'Cash' && (
                    <>
                      <DetailRow
                        label="Uang Diterima"
                        value={formatRupiah(selectedTransaction.paidAmount ?? 0)}
                      />
                      <DetailRow
                        label="Kembalian"
                        value={formatRupiah(selectedTransaction.changeAmount ?? 0)}
                      />
                    </>
                  )}
                  <DetailRow
                    label="Jumlah Item"
                    value={`${selectedSummary?.itemCount ?? 0} item`}
                  />
                  <DetailRow
                    label="Total HPP"
                    value={formatRupiah(selectedSummary?.totalHpp ?? 0)}
                  />
                  <DetailRow
                    label="Estimasi Profit"
                    value={formatRupiah(selectedSummary?.estimatedProfit ?? 0)}
                  />
                  <DetailRow
                    label="Margin"
                    value={
                      selectedSummary && Number.isFinite(selectedSummary.margin)
                        ? `${selectedSummary.margin.toFixed(1)}%`
                        : '-'
                    }
                  />
                </div>
              </section>

              <section className="rounded-lg bg-santara-cream p-3 ring-1 ring-santara-latte">
                <h4 className="text-sm font-black">Detail Item</h4>
                <div className="mt-3 space-y-1 text-sm font-bold">
                  {selectedTransaction.items.map((item) => (
                    <div className="flex justify-between gap-2" key={item.id}>
                      <div>
                        <p>
                          {item.quantity}x {item.nameSnapshot}
                        </p>
                        <p className="text-xs text-santara-roast/55">
                          HPP {formatRupiah((item.hppSnapshot ?? 0) * item.quantity)}
                        </p>
                      </div>
                      <span className="text-right">{formatRupiah(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <h4 className="text-sm font-black">Preview Struk</h4>
              <ReceiptPreview isReprint transaction={selectedTransaction} />
            </div>
          ) : (
            <div className="grid h-full min-h-72 place-items-center rounded-lg border border-dashed border-santara-latte bg-santara-cream/70 p-5 text-center">
              <p className="text-sm font-bold text-santara-roast/60">
                Pilih struk untuk melihat detail.
              </p>
            </div>
          )}
        </div>
      </aside>
      {voidTarget && (
        <VoidReceiptModal
          currentUserName={currentUserName}
          onCancel={() => setVoidTarget(null)}
          onConfirm={(reason) => {
            onVoidReceipt(voidTarget.receiptNumber, reason);
            setVoidTarget(null);
          }}
          transaction={voidTarget}
        />
      )}
    </section>
  );
}

type DetailRowProps = {
  label: string;
  value: string;
  strong?: boolean;
};

function DetailRow({ label, value, strong = false }: DetailRowProps) {
  return (
    <div
      className={`flex items-start justify-between gap-3 ${
        strong ? 'border-t border-santara-latte pt-2 text-base' : ''
      }`}
    >
      <span className="text-santara-roast/60">{label}</span>
      <span className="text-right text-santara-roast">{value}</span>
    </div>
  );
}

type HistoryCardProps = {
  label: string;
  value: string;
};

function HistoryCard({ label, value }: HistoryCardProps) {
  return (
    <div className="rounded-lg bg-white px-3 py-3 ring-1 ring-santara-latte">
      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-santara-sage">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-santara-roast">{value}</p>
    </div>
  );
}

function getTransactionQuantity(transaction: CompletedTransaction) {
  return transaction.items.reduce((total, item) => total + item.quantity, 0);
}

function getTransactionSummary(transaction: CompletedTransaction) {
  const itemCount = getTransactionQuantity(transaction);
  const totalHpp = transaction.items.reduce(
    (total, item) => total + (item.hppSnapshot ?? 0) * item.quantity,
    0,
  );
  const estimatedProfit = transaction.totalAfterDiscount - totalHpp;
  const margin =
    transaction.totalAfterDiscount > 0
      ? (estimatedProfit / transaction.totalAfterDiscount) * 100
      : 0;

  return {
    itemCount,
    totalHpp,
    estimatedProfit,
    margin,
  };
}

function formatDiscountLabel(transaction: CompletedTransaction) {
  if (transaction.discountType === 'percentage') {
    return `${transaction.discountValue}%`;
  }

  if (transaction.discountType === 'fixed') {
    return formatRupiah(transaction.discountValue);
  }

  return 'Tidak ada diskon';
}

type VoidReceiptModalProps = {
  currentUserName: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  transaction: CompletedTransaction;
};

const voidReasonOptions = [
  'Salah input menu',
  'Salah metode pembayaran',
  'Customer batal',
  'Double input',
  'Lainnya',
];

function VoidReceiptModal({
  currentUserName,
  onCancel,
  onConfirm,
  transaction,
}: VoidReceiptModalProps) {
  const [reasonPreset, setReasonPreset] = useState(voidReasonOptions[0]);
  const [notes, setNotes] = useState('');
  const reason =
    reasonPreset === 'Lainnya'
      ? notes.trim()
      : notes.trim()
        ? `${reasonPreset} - ${notes.trim()}`
        : reasonPreset;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-santara-roast/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg bg-santara-foam p-5 shadow-soft ring-1 ring-santara-latte">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-santara-clay">
          Batalkan Struk
        </p>
        <h2 className="mt-1 text-2xl font-black text-santara-roast">
          {transaction.receiptNumber}
        </h2>
        <p className="mt-2 text-sm font-medium leading-relaxed text-santara-roast/70">
          Struk tidak akan dihapus. Sistem akan menandai struk sebagai
          dibatalkan dan laporan tidak akan menghitung nilainya.
        </p>
        <p className="mt-2 text-xs font-bold text-santara-roast/55">
          Dibatalkan oleh: {currentUserName}
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {voidReasonOptions.map((option) => (
            <button
              className={`rounded-lg px-3 py-2 text-sm font-black transition ${
                reasonPreset === option
                  ? 'bg-santara-bean text-white'
                  : 'bg-white text-santara-roast ring-1 ring-santara-latte'
              }`}
              key={option}
              onClick={() => setReasonPreset(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>

        <label className="mt-3 block">
          <span className="text-sm font-bold text-santara-roast/70">
            Keterangan
          </span>
          <textarea
            className="mt-2 min-h-24 w-full rounded-lg bg-white px-3 py-2 text-sm font-bold text-santara-roast outline-none ring-1 ring-santara-latte transition focus:ring-2 focus:ring-santara-clay"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Tambahkan catatan pembatalan"
            value={notes}
          />
        </label>

        {reasonPreset === 'Lainnya' && !notes.trim() && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
            Keterangan wajib diisi untuk alasan lainnya.
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            className="rounded-lg bg-white px-4 py-3 text-sm font-black text-santara-clay ring-1 ring-santara-latte transition hover:bg-santara-cream"
            onClick={onCancel}
            type="button"
          >
            Batal
          </button>
          <button
            className="rounded-lg bg-santara-bean px-4 py-3 text-sm font-black text-white shadow-soft transition hover:bg-santara-roast disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!reason}
            onClick={() => onConfirm(reason)}
            type="button"
          >
            Batalkan Struk
          </button>
        </div>
      </div>
    </div>
  );
}

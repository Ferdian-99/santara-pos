import { useMemo, useState, type ReactNode } from 'react';
import { DailyClosing } from './DailyClosing';
import { GoogleSheetSync } from './GoogleSheetSync';
import { LegacyImport } from './LegacyImport';
import type {
  CompletedTransaction,
  DailyClosing as DailyClosingData,
  Expense,
  GoogleSheetSyncLog,
  GoogleSheetSyncSettings,
  LegacyImportBatch,
  LegacySale,
} from '../types';
import { formatRupiah } from '../utils/format';
import { exportReportCsv, exportReportJson } from '../utils/reportExport';
import {
  buildSalesReport,
  getTodayInputValue,
  type MenuSalesSummary,
  type ReportMode,
} from '../utils/reports';

type ReportsProps = {
  transactions: CompletedTransaction[];
  legacySales: LegacySale[];
  expenses: Expense[];
  dailyClosings: DailyClosingData[];
  googleSheetSyncSettings: GoogleSheetSyncSettings;
  googleSheetSyncLogs: GoogleSheetSyncLog[];
  legacyImportBatches: LegacyImportBatch[];
  currentUserName: string;
  onSaveLegacyImport: (batch: LegacyImportBatch, sales: LegacySale[]) => void;
  onSaveClosing: (closing: DailyClosingData) => void;
  onSaveGoogleSheetSettings: (settings: GoogleSheetSyncSettings) => void;
  onAddGoogleSheetSyncLog: (log: GoogleSheetSyncLog) => void;
  onResetOperationalData: () => void;
};

const reportModes: { label: string; value: ReportMode }[] = [
  { label: 'Hari Ini', value: 'today' },
  { label: 'Pilih Tanggal', value: 'date' },
  { label: 'Bulan Ini', value: 'month' },
  { label: 'Semua Waktu', value: 'all' },
];

export function Reports({
  currentUserName,
  dailyClosings,
  expenses,
  googleSheetSyncLogs,
  googleSheetSyncSettings,
  legacyImportBatches,
  legacySales,
  onAddGoogleSheetSyncLog,
  onResetOperationalData,
  onSaveClosing,
  onSaveGoogleSheetSettings,
  onSaveLegacyImport,
  transactions,
}: ReportsProps) {
  const [reportMode, setReportMode] = useState<ReportMode>('today');
  const [selectedDate, setSelectedDate] = useState(getTodayInputValue);
  const [isAdminToolsOpen, setIsAdminToolsOpen] = useState(false);
  const [isLegacyImportOpen, setIsLegacyImportOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [adminToolMessage, setAdminToolMessage] = useState('');
  const report = useMemo(
    () =>
      buildSalesReport(
        transactions,
        reportMode,
        selectedDate,
        legacySales,
        expenses,
        dailyClosings,
      ),
    [dailyClosings, expenses, legacySales, reportMode, selectedDate, transactions],
  );
  const hasReportData = report.totalTransactions > 0 || report.expenses.length > 0;
  const voidedReceiptCount = transactions.filter(
    (transaction) => transaction.status === 'voided',
  ).length;
  const closingDate =
    reportMode === 'today' ? getTodayInputValue() : reportMode === 'date' ? selectedDate : '';
  const canUseDailyClosing = reportMode === 'today' || reportMode === 'date';
  const exportContext = {
    report,
    reportMode,
    selectedDate,
  };

  return (
    <section className="flex min-h-0 flex-col rounded-lg bg-santara-foam/80 p-3 shadow-soft ring-1 ring-santara-latte/70">
      <div className="flex shrink-0 flex-col gap-3 border-b border-santara-latte/70 pb-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-santara-clay">
            Laporan
          </p>
          <h2 className="text-2xl font-black text-santara-roast">
            Laporan Penjualan Lokal
          </h2>
          <p className="mt-1 text-sm text-santara-roast/65">
            Ringkasan gabungan dari transaksi POS dan data import lama.
          </p>
          <p className="mt-2 w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-santara-bean ring-1 ring-santara-latte">
            Termasuk data import lama
          </p>
          <p className="mt-2 text-xs font-bold text-santara-roast/55">
            Struk dibatalkan tidak dihitung dalam laporan.
            {voidedReceiptCount > 0 ? ` ${voidedReceiptCount} struk dibatalkan tersimpan.` : ''}
          </p>
        </div>

        <div className="grid gap-2 lg:w-[780px]">
          <div className="flex flex-wrap gap-2">
            {reportModes.map((mode) => (
              <button
                className={`min-w-[132px] flex-1 rounded-lg px-3 py-3 text-xs font-black transition sm:flex-none ${
                  reportMode === mode.value
                    ? 'bg-santara-bean text-white shadow-soft'
                    : 'bg-white text-santara-roast ring-1 ring-santara-latte hover:bg-santara-cream'
                }`}
                key={mode.value}
                onClick={() => setReportMode(mode.value)}
                type="button"
              >
                {mode.label}
              </button>
            ))}
            <button
              className={`min-w-[132px] flex-1 rounded-lg px-3 py-3 text-xs font-black transition sm:flex-none ${
                isAdminToolsOpen
                  ? 'bg-santara-clay text-white shadow-soft'
                  : 'bg-white text-santara-bean ring-1 ring-santara-latte hover:bg-santara-cream'
              }`}
              onClick={() => setIsAdminToolsOpen((open) => !open)}
              type="button"
            >
              {isAdminToolsOpen ? 'Tutup Admin Tools' : 'Admin Tools'}
            </button>
          </div>

          {reportMode === 'date' && (
            <input
              className="w-full rounded-lg bg-white px-3 py-3 text-sm font-black text-santara-roast outline-none ring-1 ring-santara-latte transition focus:ring-2 focus:ring-santara-clay sm:w-[220px]"
              onChange={(event) => setSelectedDate(event.target.value)}
              type="date"
              value={selectedDate}
            />
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-3">
        {isAdminToolsOpen && (
          <section className="mb-3 rounded-lg bg-white p-3 ring-1 ring-santara-latte">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-santara-clay">
                Admin Tools
              </p>
              <h3 className="mt-1 text-lg font-black text-santara-roast">
                Alat Admin Laporan
              </h3>
              <p className="mt-1 text-sm text-santara-roast/65">
                Export, import data lama, dan reset data testing disimpan di sini
                agar alur laporan harian tetap bersih.
              </p>
            </div>

            {adminToolMessage && (
              <p className="mt-3 rounded-lg bg-santara-cream px-3 py-2 text-sm font-black text-santara-bean ring-1 ring-santara-latte">
                {adminToolMessage}
              </p>
            )}

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <button
                className="rounded-lg bg-santara-bean px-3 py-3 text-xs font-black text-white shadow-sm transition hover:bg-santara-roast disabled:cursor-not-allowed disabled:opacity-45"
                disabled={!hasReportData}
                onClick={() => exportReportCsv(exportContext)}
                type="button"
              >
                Export CSV
              </button>
              <button
                className="rounded-lg bg-white px-3 py-3 text-xs font-black text-santara-bean ring-1 ring-santara-latte transition hover:bg-santara-cream disabled:cursor-not-allowed disabled:opacity-45"
                disabled={!hasReportData}
                onClick={() => exportReportJson(exportContext)}
                type="button"
              >
                Export JSON
              </button>
              <button
                className="rounded-lg bg-santara-cream px-3 py-3 text-xs font-black text-santara-bean ring-1 ring-santara-latte transition hover:bg-santara-foam"
                onClick={() => setIsLegacyImportOpen(true)}
                type="button"
              >
                Import Data Lama POS
              </button>
              <button
                className="rounded-lg bg-white px-3 py-3 text-xs font-black text-santara-clay ring-1 ring-santara-latte transition hover:bg-santara-cream"
                onClick={() => {
                  setResetConfirmText('');
                  setIsResetModalOpen(true);
                }}
                type="button"
              >
                Reset Data Operasional Testing
              </button>
            </div>
            {!hasReportData && (
              <p className="mt-2 text-xs font-bold text-santara-roast/55">
                Tidak ada data laporan untuk diexport.
              </p>
            )}
          </section>
        )}
        {!hasReportData ? (
          <EmptyReportState />
        ) : (
          <div className="space-y-3">
            <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <ReportCard
                label="Penjualan Kotor"
                value={formatRupiah(report.grossSales)}
              />
              <ReportCard
                label="Total Diskon"
                value={formatRupiah(report.totalDiscount)}
              />
              <ReportCard
                label="Penjualan Bersih"
                value={formatRupiah(report.netSales)}
              />
              <ReportCard label="Total HPP" value={formatRupiah(report.totalHpp)} />
              <ReportCard
                label="Laba Kotor"
                value={formatRupiah(report.grossProfit)}
              />
              <ReportCard
                label="Gross Margin"
                value={formatPercent(report.grossMargin)}
              />
              <ReportCard
                label="Total Transaksi"
                value={`${report.totalTransactions} data`}
              />
              <ReportCard
                label="Rata-rata Transaksi"
                value={formatRupiah(report.averageTransactionValue)}
              />
              <ReportCard
                label="Total Pengeluaran"
                value={formatRupiah(report.totalExpenses)}
              />
              <ReportCard
                label="Laba Bersih"
                value={formatRupiah(report.netProfit)}
              />
              <ReportCard
                label="Net Margin"
                value={formatPercent(report.netMargin)}
              />
            </section>

            <section className="grid gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="space-y-3">
                <Panel title="Ringkasan Pembayaran">
                  <div className="space-y-2">
                    {report.paymentSummary.map((summary) => (
                      <SummaryLine
                        key={summary.method}
                        label={summary.method}
                        meta={`${summary.transactionCount} transaksi`}
                        value={formatRupiah(summary.total)}
                      />
                    ))}
                  </div>
                </Panel>

                <Panel title="Sumber Data">
                  <div className="space-y-2">
                    <SummaryLine
                      label="Transaksi POS"
                      value={`${report.sourceTransactionCount} struk`}
                    />
                    <SummaryLine
                      label="Import lama"
                      value={`${report.sourceLegacyCount} baris`}
                    />
                  </div>
                </Panel>

                <Panel title="Ringkasan Diskon">
                  <div className="space-y-2">
                    <SummaryLine
                      label="Total diskon"
                      value={formatRupiah(report.totalDiscount)}
                    />
                    <SummaryLine
                      label="Transaksi berdiskon"
                      value={`${report.discountedTransactionCount} struk`}
                    />
                    <SummaryLine
                      label="Rata-rata diskon"
                      value={formatRupiah(report.averageDiscount)}
                    />
                  </div>
                </Panel>

                <Panel title="Ringkasan Pengeluaran">
                  {report.expenseSummary.length === 0 ? (
                    <p className="text-sm font-bold text-santara-roast/55">
                      Belum ada pengeluaran di periode ini.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {report.expenseSummary.map((summary) => (
                        <SummaryLine
                          key={summary.category}
                          label={summary.category}
                          value={formatRupiah(summary.total)}
                        />
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title="Best Seller">
                  {report.bestSellers.length === 0 ? (
                    <p className="text-sm font-bold text-santara-roast/55">
                      Belum ada item terjual di periode ini.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {report.bestSellers.map((item, index) => (
                        <BestSellerItem
                          index={index + 1}
                          item={item}
                          key={item.key}
                        />
                      ))}
                    </div>
                  )}
                </Panel>
              </div>

              <Panel title="Ringkasan Penjualan Menu">
                {report.menuSales.length === 0 ? (
                  <p className="text-sm font-bold text-santara-roast/55">
                    Belum ada menu terjual di periode ini.
                  </p>
                ) : (
                  <MenuSalesTable items={report.menuSales} />
                )}
              </Panel>
            </section>

            <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
              <Panel title="Daftar Pengeluaran">
                {report.expenses.length === 0 ? (
                  <p className="text-sm font-bold text-santara-roast/55">
                    Belum ada pengeluaran di periode ini.
                  </p>
                ) : (
                  <ExpenseTable expenses={report.expenses} />
                )}
              </Panel>

              <GoogleSheetSync
                currentUserName={currentUserName}
                logs={googleSheetSyncLogs}
                onAddLog={onAddGoogleSheetSyncLog}
                onSaveSettings={onSaveGoogleSheetSettings}
                report={report}
                reportMode={reportMode}
                selectedDate={selectedDate}
                settings={googleSheetSyncSettings}
              />
            </section>

            {canUseDailyClosing && (
              <DailyClosing
                cashierName={currentUserName}
                key={report.dailyClosing?.id ?? closingDate}
                onSaveClosing={onSaveClosing}
                report={report}
                selectedDate={closingDate}
              />
            )}
          </div>
        )}
      </div>

      {isLegacyImportOpen && (
        <LegacyImportModal onClose={() => setIsLegacyImportOpen(false)}>
          <LegacyImport
            batches={legacyImportBatches}
            importedBy={currentUserName}
            onSaveImport={(batch, sales) => {
              onSaveLegacyImport(batch, sales);
              setAdminToolMessage('Data import lama berhasil disimpan.');
              setIsLegacyImportOpen(false);
            }}
          />
        </LegacyImportModal>
      )}

      {isResetModalOpen && (
        <OperationalResetModal
          confirmText={resetConfirmText}
          onCancel={() => {
            setIsResetModalOpen(false);
            setResetConfirmText('');
          }}
          onConfirm={() => {
            onResetOperationalData();
            setIsResetModalOpen(false);
            setResetConfirmText('');
            setAdminToolMessage('Data operasional testing berhasil direset.');
          }}
          onConfirmTextChange={setResetConfirmText}
        />
      )}
    </section>
  );
}

type LegacyImportModalProps = {
  children: ReactNode;
  onClose: () => void;
};

function LegacyImportModal({ children, onClose }: LegacyImportModalProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-santara-roast/55 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-santara-foam p-3 shadow-soft ring-1 ring-santara-latte">
        <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-santara-clay">
              Admin Tools
            </p>
            <h2 className="mt-1 text-xl font-black text-santara-roast">
              Import Data Lama POS
            </h2>
          </div>
          <button
            className="rounded-lg bg-white px-3 py-2 text-xs font-black text-santara-clay ring-1 ring-santara-latte transition hover:bg-santara-cream"
            onClick={onClose}
            type="button"
          >
            Tutup
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

type OperationalResetModalProps = {
  confirmText: string;
  onCancel: () => void;
  onConfirm: () => void;
  onConfirmTextChange: (value: string) => void;
};

function OperationalResetModal({
  confirmText,
  onCancel,
  onConfirm,
  onConfirmTextChange,
}: OperationalResetModalProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-santara-roast/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-santara-foam p-5 shadow-soft ring-1 ring-santara-latte">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-santara-clay">
          Admin Tools
        </p>
        <h2 className="mt-1 text-2xl font-black text-santara-roast">
          Reset Data Operasional Testing
        </h2>
        <p className="mt-3 text-sm font-medium leading-relaxed text-santara-roast/70">
          Ini hanya menghapus data operasional lokal/testing di browser ini. Menu
          dan kategori tidak akan dihapus. Reset ini tidak otomatis menghapus data
          di Supabase atau Google Sheet.
        </p>
        <label className="mt-4 block">
          <span className="text-sm font-bold text-santara-roast/70">
            Ketik RESET untuk lanjut
          </span>
          <input
            className="mt-2 w-full rounded-lg bg-white px-3 py-3 text-sm font-black text-santara-roast outline-none ring-1 ring-santara-latte transition focus:ring-2 focus:ring-santara-clay"
            onChange={(event) => onConfirmTextChange(event.target.value)}
            value={confirmText}
          />
        </label>

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
            disabled={confirmText !== 'RESET'}
            onClick={onConfirm}
            type="button"
          >
            Lanjutkan
          </button>
        </div>
      </div>
    </div>
  );
}

type ExpenseTableProps = {
  expenses: Expense[];
};

function ExpenseTable({ expenses }: ExpenseTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-santara-latte">
      <table className="w-full min-w-[720px] border-collapse bg-white text-left text-sm">
        <thead className="bg-santara-cream text-[10px] font-black uppercase tracking-[0.08em] text-santara-sage">
          <tr>
            <TableHeader>Tanggal</TableHeader>
            <TableHeader>Nama</TableHeader>
            <TableHeader>Kategori</TableHeader>
            <TableHeader>Metode</TableHeader>
            <TableHeader align="right">Nominal</TableHeader>
          </tr>
        </thead>
        <tbody className="divide-y divide-santara-latte">
          {expenses.map((expense) => (
            <tr className="transition hover:bg-santara-cream/55" key={expense.id}>
              <TableCell>{expense.date}</TableCell>
              <TableCell strong>{expense.name}</TableCell>
              <TableCell>{expense.category}</TableCell>
              <TableCell>{expense.paymentMethod}</TableCell>
              <TableCell align="right">{formatRupiah(expense.amount)}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ReportCardProps = {
  label: string;
  value: string;
};

function ReportCard({ label, value }: ReportCardProps) {
  return (
    <div className="rounded-lg bg-white px-3 py-3 ring-1 ring-santara-latte">
      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-santara-sage">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-santara-roast">{value}</p>
    </div>
  );
}

type PanelProps = {
  title: string;
  children: ReactNode;
};

function Panel({ title, children }: PanelProps) {
  return (
    <section className="rounded-lg bg-white p-3 ring-1 ring-santara-latte">
      <h3 className="text-base font-black text-santara-roast">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

type SummaryLineProps = {
  label: string;
  value: string;
  meta?: string;
};

function SummaryLine({ label, value, meta }: SummaryLineProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-santara-cream/75 px-3 py-2 ring-1 ring-santara-latte">
      <div>
        <p className="text-sm font-black text-santara-roast">{label}</p>
        {meta && (
          <p className="mt-0.5 text-xs font-bold text-santara-roast/55">{meta}</p>
        )}
      </div>
      <p className="text-right text-sm font-black text-santara-bean">{value}</p>
    </div>
  );
}

type MenuSalesTableProps = {
  items: MenuSalesSummary[];
};

function MenuSalesTable({ items }: MenuSalesTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-santara-latte">
      <table className="min-w-[920px] w-full border-collapse bg-white text-left text-sm">
        <thead className="bg-santara-cream text-[10px] font-black uppercase tracking-[0.08em] text-santara-sage">
          <tr>
            <TableHeader>Menu</TableHeader>
            <TableHeader>Kategori</TableHeader>
            <TableHeader align="right">Qty</TableHeader>
            <TableHeader align="right">Gross Sales</TableHeader>
            <TableHeader align="right">Diskon</TableHeader>
            <TableHeader align="right">Net Sales</TableHeader>
            <TableHeader align="right">HPP</TableHeader>
            <TableHeader align="right">Profit</TableHeader>
            <TableHeader align="right">Margin</TableHeader>
          </tr>
        </thead>
        <tbody className="divide-y divide-santara-latte">
          {items.map((item) => (
            <tr className="transition hover:bg-santara-cream/55" key={item.key}>
              <TableCell strong>{item.name}</TableCell>
              <TableCell>{item.category}</TableCell>
              <TableCell align="right">{item.quantity}</TableCell>
              <TableCell align="right">{formatRupiah(item.grossSales)}</TableCell>
              <TableCell align="right">{formatRupiah(item.discountAmount)}</TableCell>
              <TableCell align="right">{formatRupiah(item.netSales)}</TableCell>
              <TableCell align="right">{formatRupiah(item.hpp)}</TableCell>
              <TableCell align="right">{formatRupiah(item.estimatedProfit)}</TableCell>
              <TableCell align="right">{formatPercent(item.margin)}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type TableHeaderProps = {
  children: ReactNode;
  align?: 'left' | 'right';
};

function TableHeader({ children, align = 'left' }: TableHeaderProps) {
  return (
    <th
      className={`whitespace-nowrap px-3 py-3 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
      scope="col"
    >
      {children}
    </th>
  );
}

type TableCellProps = {
  children: ReactNode;
  align?: 'left' | 'right';
  strong?: boolean;
};

function TableCell({ children, align = 'left', strong = false }: TableCellProps) {
  return (
    <td
      className={`whitespace-nowrap px-3 py-2.5 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${strong ? 'font-black text-santara-roast' : 'font-bold text-santara-roast/75'}`}
    >
      {children}
    </td>
  );
}

type BestSellerItemProps = {
  index: number;
  item: MenuSalesSummary;
};

function BestSellerItem({ index, item }: BestSellerItemProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-santara-cream/75 px-3 py-2 ring-1 ring-santara-latte">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-santara-bean text-xs font-black text-white">
          {index}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{item.name}</p>
          <p className="text-xs font-bold text-santara-roast/55">{item.category}</p>
        </div>
      </div>
      <p className="shrink-0 text-sm font-black text-santara-bean">
        {item.quantity} item
      </p>
    </div>
  );
}

function EmptyReportState() {
  return (
    <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-santara-latte bg-white p-5 text-center">
      <div>
        <p className="text-lg font-black text-santara-roast">
          Belum ada data transaksi
        </p>
        <p className="mt-2 max-w-md text-sm font-medium text-santara-roast/65">
          Selesaikan transaksi di tab Kasir atau import data lama, lalu laporan
          penjualan akan muncul otomatis di sini.
        </p>
      </div>
    </div>
  );
}

function formatPercent(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`;
}

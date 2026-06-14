import { useRef, useState, type ReactNode } from 'react';
import type { LegacyImportBatch, LegacySale } from '../types';
import { formatRupiah } from '../utils/format';
import {
  createLegacyImportPayload,
  parseLegacySalesCsv,
  type LegacyImportPreview,
} from '../utils/legacyImportParser';

type LegacyImportProps = {
  batches: LegacyImportBatch[];
  importedBy: string;
  onSaveImport: (batch: LegacyImportBatch, sales: LegacySale[]) => void;
};

export function LegacyImport({
  batches,
  importedBy,
  onSaveImport,
}: LegacyImportProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<LegacyImportPreview | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  const similarBatch = preview
    ? findSimilarBatch(batches, preview.fileName, preview.dateStart, preview.dateEnd)
    : null;

  const handleFileChange = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setSelectedFile(file);
    setCsvText(await file.text());
    setPreview(null);
    setStatusMessage('');
  };

  const previewImport = () => {
    if (!selectedFile || !csvText) {
      setStatusMessage('Pilih file CSV terlebih dahulu.');
      return;
    }

    setPreview(parseLegacySalesCsv(csvText, selectedFile.name));
    setStatusMessage('');
  };

  const saveImport = (skipDuplicateWarning = false) => {
    if (!preview || preview.validRows === 0) {
      setStatusMessage('Tidak ada baris valid untuk disimpan.');
      return;
    }

    if (similarBatch && !skipDuplicateWarning) {
      setIsDuplicateModalOpen(true);
      return;
    }

    const { batch, sales } = createLegacyImportPayload(preview, importedBy);

    onSaveImport(batch, sales);
    cancelImport();
    setStatusMessage('Data import lama berhasil disimpan.');
  };

  const cancelImport = () => {
    setSelectedFile(null);
    setCsvText('');
    setPreview(null);
    setIsDuplicateModalOpen(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <section className="flex min-h-0 flex-col rounded-lg bg-santara-foam/80 p-3 shadow-soft ring-1 ring-santara-latte/70">
      <div className="flex shrink-0 flex-col gap-3 border-b border-santara-latte/70 pb-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-santara-clay">
            Import Data Lama
          </p>
          <h2 className="text-2xl font-black text-santara-roast">
            Import Data Lama
          </h2>
          <p className="mt-1 text-sm text-santara-roast/65">
            Data import lama akan ikut dihitung di laporan, tanpa muncul sebagai
            struk normal.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-4 lg:w-[620px]">
          <button
            className="rounded-lg bg-white px-3 py-3 text-xs font-black text-santara-bean ring-1 ring-santara-latte transition hover:bg-santara-cream"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            Pilih File CSV
          </button>
          <button
            className="rounded-lg bg-santara-bean px-3 py-3 text-xs font-black text-white shadow-sm transition hover:bg-santara-roast disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!selectedFile}
            onClick={previewImport}
            type="button"
          >
            Preview Import
          </button>
          <button
            className="rounded-lg bg-santara-bean px-3 py-3 text-xs font-black text-white shadow-sm transition hover:bg-santara-roast disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!preview || preview.validRows === 0}
            onClick={() => saveImport()}
            type="button"
          >
            Simpan Import
          </button>
          <button
            className="rounded-lg bg-white px-3 py-3 text-xs font-black text-santara-clay ring-1 ring-santara-latte transition hover:bg-santara-cream"
            onClick={cancelImport}
            type="button"
          >
            Batal
          </button>
        </div>
      </div>

      <input
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => handleFileChange(event.target.files?.[0])}
        ref={fileInputRef}
        type="file"
      />

      <div className="min-h-0 flex-1 overflow-y-auto pt-3">
        {statusMessage && (
          <p className="mb-3 rounded-lg bg-white px-3 py-2 text-sm font-black text-santara-bean ring-1 ring-santara-latte">
            {statusMessage}
          </p>
        )}

        {selectedFile && (
          <p className="mb-3 rounded-lg bg-white px-3 py-2 text-sm font-bold text-santara-roast/70 ring-1 ring-santara-latte">
            File dipilih: <span className="font-black">{selectedFile.name}</span>
          </p>
        )}

        {preview ? (
          <div className="space-y-3">
            <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard label="Total Baris" value={String(preview.validRows)} />
              <MetricCard
                label="Penjualan Kotor"
                value={formatRupiah(preview.totalGrossSales)}
              />
              <MetricCard label="Diskon" value={formatRupiah(preview.totalDiscount)} />
              <MetricCard
                label="Penjualan Bersih"
                value={formatRupiah(preview.totalNetSales)}
              />
              <MetricCard label="HPP" value={formatRupiah(preview.totalHpp)} />
            </section>

            {preview.warnings.length > 0 && (
              <section className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800 ring-1 ring-amber-200">
                <p className="font-black">Catatan preview</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {preview.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rounded-lg bg-white p-3 ring-1 ring-santara-latte">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-black">Preview Import</h3>
                <p className="text-xs font-bold text-santara-roast/55">
                  {preview.validRows} valid dari {preview.totalRows} baris
                </p>
              </div>
              <div className="overflow-x-auto rounded-lg ring-1 ring-santara-latte">
                <table className="min-w-[980px] w-full border-collapse bg-white text-left text-sm">
                  <thead className="bg-santara-cream text-[10px] font-black uppercase tracking-[0.08em] text-santara-sage">
                    <tr>
                      <TableHeader>Baris</TableHeader>
                      <TableHeader>Tanggal</TableHeader>
                      <TableHeader>Menu</TableHeader>
                      <TableHeader>Kategori</TableHeader>
                      <TableHeader align="right">Qty</TableHeader>
                      <TableHeader align="right">Penjualan Kotor</TableHeader>
                      <TableHeader align="right">Diskon</TableHeader>
                      <TableHeader align="right">Penjualan Bersih</TableHeader>
                      <TableHeader align="right">HPP</TableHeader>
                      <TableHeader>Catatan</TableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-santara-latte">
                    {preview.rows.slice(0, 80).map((row) => (
                      <tr
                        className={row.isValid ? 'hover:bg-santara-cream/55' : 'bg-red-50'}
                        key={row.rowNumber}
                      >
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>{row.saleDate || '-'}</TableCell>
                        <TableCell strong>{row.menuName || '-'}</TableCell>
                        <TableCell>{row.category}</TableCell>
                        <TableCell align="right">{row.quantity}</TableCell>
                        <TableCell align="right">{formatRupiah(row.grossSales)}</TableCell>
                        <TableCell align="right">{formatRupiah(row.discountAmount)}</TableCell>
                        <TableCell align="right">{formatRupiah(row.netSales)}</TableCell>
                        <TableCell align="right">{formatRupiah(row.hppTotal)}</TableCell>
                        <TableCell>
                          {row.warnings.length > 0 ? row.warnings.join(', ') : row.notes || '-'}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rows.length > 80 && (
                <p className="mt-2 text-xs font-bold text-santara-roast/55">
                  Preview menampilkan 80 baris pertama agar halaman tetap ringan.
                </p>
              )}
            </section>
          </div>
        ) : (
          <EmptyImportState />
        )}

        <ImportHistory batches={batches} />
      </div>

      {isDuplicateModalOpen && similarBatch && (
        <DuplicateConfirmModal
          batch={similarBatch}
          onCancel={() => setIsDuplicateModalOpen(false)}
          onConfirm={() => saveImport(true)}
        />
      )}
    </section>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
};

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded-lg bg-white px-3 py-3 ring-1 ring-santara-latte">
      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-santara-sage">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-santara-roast">{value}</p>
    </div>
  );
}

type ImportHistoryProps = {
  batches: LegacyImportBatch[];
};

function ImportHistory({ batches }: ImportHistoryProps) {
  return (
    <section className="mt-3 rounded-lg bg-white p-3 ring-1 ring-santara-latte">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-black">Riwayat Import</h3>
        <span className="rounded-full bg-santara-cream px-2 py-1 text-xs font-black text-santara-bean">
          {batches.length} batch
        </span>
      </div>

      {batches.length === 0 ? (
        <p className="text-sm font-bold text-santara-roast/55">
          Belum ada import data lama.
        </p>
      ) : (
        <div className="space-y-2">
          {batches.map((batch) => (
            <article
              className="grid gap-2 rounded-lg bg-santara-cream/75 p-3 ring-1 ring-santara-latte md:grid-cols-[1.4fr_1fr_1fr_1fr]"
              key={batch.id}
            >
              <div>
                <p className="font-black">{batch.fileName}</p>
                <p className="text-xs font-bold text-santara-roast/55">
                  {new Date(batch.importedAt).toLocaleString('id-ID')}
                </p>
              </div>
              <HistoryMeta label="Total Baris" value={`${batch.totalRows} baris`} />
              <HistoryMeta
                label="Periode"
                value={`${batch.dateStart || '-'} - ${batch.dateEnd || '-'}`}
              />
              <HistoryMeta
                label="Penjualan Bersih"
                value={formatRupiah(batch.totalNetSales)}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyImportState() {
  return (
    <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-santara-latte bg-white p-5 text-center">
      <div>
        <p className="text-lg font-black text-santara-roast">
          Pilih CSV untuk mulai import
        </p>
        <p className="mt-2 max-w-md text-sm font-medium text-santara-roast/65">
          Sistem akan mencoba membaca kolom tanggal, menu, kategori, qty,
          penjualan, diskon, HPP, metode pembayaran, dan catatan.
        </p>
      </div>
    </div>
  );
}

type DuplicateConfirmModalProps = {
  batch: LegacyImportBatch;
  onCancel: () => void;
  onConfirm: () => void;
};

function DuplicateConfirmModal({
  batch,
  onCancel,
  onConfirm,
}: DuplicateConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-santara-roast/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-santara-foam p-5 shadow-soft ring-1 ring-santara-latte">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-santara-clay">
          Import Data Lama
        </p>
        <h2 className="mt-1 text-2xl font-black text-santara-roast">
          Data mirip sudah pernah diimport
        </h2>
        <p className="mt-3 text-sm font-medium leading-relaxed text-santara-roast/70">
          File atau rentang tanggal terlihat mirip dengan import sebelumnya:
          <span className="mt-2 block font-black text-santara-roast">
            {batch.fileName} ({batch.dateStart || '-'} - {batch.dateEnd || '-'})
          </span>
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
            Lanjutkan
          </button>
        </div>
      </div>
    </div>
  );
}

type HistoryMetaProps = {
  label: string;
  value: string;
};

function HistoryMeta({ label, value }: HistoryMetaProps) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-santara-sage">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-santara-roast">{value}</p>
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

function findSimilarBatch(
  batches: LegacyImportBatch[],
  fileName: string,
  dateStart: string,
  dateEnd: string,
) {
  return batches.find((batch) => {
    const sameFile = batch.fileName.toLowerCase() === fileName.toLowerCase();
    const sameRange =
      Boolean(dateStart && dateEnd) &&
      batch.dateStart === dateStart &&
      batch.dateEnd === dateEnd;

    return sameFile || sameRange;
  });
}

import { useRef, useState } from 'react';
import type { AppStateData, MenuItem } from '../types';
import {
  exportAppState,
  parseImportedAppState,
  resetAppState,
} from '../utils/storage';

type LocalDataPanelProps = {
  appData: AppStateData;
  defaultMenuItems: MenuItem[];
  onImportData: (data: AppStateData) => void;
  onResetData: () => void;
};

type ConfirmAction = 'import' | 'reset';
type StatusType = 'success' | 'error' | null;

export function LocalDataPanel({
  appData,
  defaultMenuItems,
  onImportData,
  onResetData,
}: LocalDataPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingImport, setPendingImport] = useState<AppStateData | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [statusType, setStatusType] = useState<StatusType>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const showStatus = (type: Exclude<StatusType, null>, message: string) => {
    setStatusType(type);
    setStatusMessage(message);
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      const parsedData = parseImportedAppState(await file.text(), defaultMenuItems);

      if (!parsedData) {
        showStatus('error', 'Data gagal dimuat');
        return;
      }

      setPendingImport(parsedData);
      setConfirmAction('import');
    } catch {
      showStatus('error', 'Data gagal dimuat');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const confirmCurrentAction = () => {
    if (confirmAction === 'import' && pendingImport) {
      onImportData(pendingImport);
      setPendingImport(null);
      setConfirmAction(null);
      showStatus('success', 'Data berhasil dimuat');
      return;
    }

    if (confirmAction === 'reset') {
      resetAppState();
      onResetData();
      setConfirmAction(null);
      showStatus('success', 'Data berhasil dimuat');
    }
  };

  const cancelCurrentAction = () => {
    setConfirmAction(null);
    setPendingImport(null);
  };

  return (
    <section className="mt-3 rounded-lg bg-white p-3 ring-1 ring-santara-latte">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-santara-clay">
            Data Lokal
          </p>
          <h3 className="mt-1 text-lg font-black text-santara-roast">
            Backup dan keamanan data lokal
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-santara-roast/65">
            Simpan backup JSON sebelum uji coba besar, atau pulihkan data lokal
            dari backup Santara POS.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[520px]">
          <button
            className="rounded-lg bg-santara-bean px-4 py-3 text-sm font-black text-white transition hover:bg-santara-roast"
            onClick={() => {
              exportAppState(appData);
              showStatus('success', 'Backup berhasil diexport');
            }}
            type="button"
          >
            Export Backup
          </button>
          <button
            className="rounded-lg bg-santara-cream px-4 py-3 text-sm font-black text-santara-bean ring-1 ring-santara-latte transition hover:bg-santara-foam"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            Import Backup
          </button>
          <button
            className="rounded-lg bg-white px-4 py-3 text-sm font-black text-santara-clay ring-1 ring-santara-latte transition hover:bg-santara-cream"
            onClick={() => setConfirmAction('reset')}
            type="button"
          >
            Reset Data Lokal
          </button>
        </div>
      </div>

      <input
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => handleImportFile(event.target.files?.[0])}
        ref={fileInputRef}
        type="file"
      />

      {statusType && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm font-bold ${
            statusType === 'success'
              ? 'bg-santara-cream text-santara-bean'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {statusMessage}
        </p>
      )}

      {confirmAction && (
        <LocalDataConfirmModal
          action={confirmAction}
          onCancel={cancelCurrentAction}
          onConfirm={confirmCurrentAction}
        />
      )}
    </section>
  );
}

type LocalDataConfirmModalProps = {
  action: ConfirmAction;
  onCancel: () => void;
  onConfirm: () => void;
};

function LocalDataConfirmModal({
  action,
  onCancel,
  onConfirm,
}: LocalDataConfirmModalProps) {
  const isReset = action === 'reset';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-santara-roast/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-santara-foam p-5 shadow-soft ring-1 ring-santara-latte">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-santara-clay">
          Data Lokal
        </p>
        <h2 className="mt-1 text-2xl font-black text-santara-roast">
          {isReset ? 'Yakin reset data lokal?' : 'Import Backup'}
        </h2>
        <p className="mt-3 text-sm font-medium leading-relaxed text-santara-roast/70">
          {isReset
            ? 'Tindakan ini akan menghapus menu editan, pending order, dan riwayat struk lokal.'
            : 'Data backup akan menggantikan menu, pending order, riwayat struk, dan nomor struk lokal saat ini.'}
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

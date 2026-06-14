import { useState, type FormEvent } from 'react';
import type { GoogleSheetSyncLog, GoogleSheetSyncSettings } from '../types';
import { formatShortTime } from '../utils/format';
import { syncReportToGoogleSheet } from '../utils/googleSheetsSync';
import type { ReportMode, SalesReport } from '../utils/reports';

type GoogleSheetSyncProps = {
  currentUserName: string;
  logs: GoogleSheetSyncLog[];
  onAddLog: (log: GoogleSheetSyncLog) => void;
  onSaveSettings: (settings: GoogleSheetSyncSettings) => void;
  report: SalesReport;
  reportMode: ReportMode;
  selectedDate: string;
  settings: GoogleSheetSyncSettings;
};

export function GoogleSheetSync({
  currentUserName,
  logs,
  onAddLog,
  onSaveSettings,
  report,
  reportMode,
  selectedDate,
  settings,
}: GoogleSheetSyncProps) {
  const [endpointUrl, setEndpointUrl] = useState(settings.endpointUrl);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const latestLog = logs[0];

  const saveUrl = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextSettings: GoogleSheetSyncSettings = {
      endpointUrl: endpointUrl.trim(),
      isEnabled: Boolean(endpointUrl.trim()),
      updatedAt: new Date().toISOString(),
      updatedBy: currentUserName,
    };

    onSaveSettings(nextSettings);
    setStatusMessage(
      nextSettings.endpointUrl ? 'URL Google Sheet tersimpan' : 'URL Google Sheet belum diatur',
    );
  };

  const syncNow = async () => {
    if (!endpointUrl.trim()) {
      setStatusMessage('URL Google Sheet belum diatur');
      return;
    }

    setIsSyncing(true);
    const log = await syncReportToGoogleSheet({
      endpointUrl,
      report,
      reportMode,
      selectedDate,
      syncedBy: currentUserName,
    });

    onAddLog(log);
    setStatusMessage(log.message);
    setIsSyncing(false);
  };

  return (
    <section className="rounded-lg bg-white p-3 ring-1 ring-santara-latte">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.12em] text-santara-clay">
          Google Sheet
        </p>
        <h3 className="text-lg font-black text-santara-roast">Google Sheet</h3>
        <p className="mt-1 text-sm text-santara-roast/65">
          Sync laporan aktif ke Apps Script Web App URL.
        </p>
      </div>

      <form className="mt-3 grid gap-2 lg:grid-cols-[1fr_120px_150px]" onSubmit={saveUrl}>
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-santara-sage">
            URL Apps Script
          </span>
          <input
            className="mt-1 w-full rounded-lg bg-white px-3 py-3 text-sm font-bold text-santara-roast outline-none ring-1 ring-santara-latte transition placeholder:text-santara-roast/35 focus:ring-2 focus:ring-santara-clay"
            onChange={(event) => setEndpointUrl(event.target.value)}
            placeholder="https://script.google.com/macros/s/..."
            value={endpointUrl}
          />
        </label>
        <button
          className="rounded-lg bg-white px-3 py-3 text-xs font-black text-santara-bean ring-1 ring-santara-latte transition hover:bg-santara-cream lg:self-end"
          type="submit"
        >
          Simpan URL
        </button>
        <button
          className="rounded-lg bg-santara-bean px-3 py-3 text-xs font-black text-white shadow-sm transition hover:bg-santara-roast disabled:cursor-not-allowed disabled:opacity-45 lg:self-end"
          disabled={isSyncing}
          onClick={syncNow}
          type="button"
        >
          {isSyncing ? 'Sync...' : 'Sync Google Sheet'}
        </button>
      </form>

      <div className="mt-3 grid gap-2 text-xs font-bold text-santara-roast/65 sm:grid-cols-2">
        <p className="rounded-lg bg-santara-cream/75 px-3 py-2 ring-1 ring-santara-latte">
          Terakhir sync:{' '}
          <span className="font-black text-santara-roast">
            {latestLog ? formatShortTime(latestLog.syncedAt) : '-'}
          </span>
        </p>
        <p
          className={`rounded-lg px-3 py-2 ring-1 ${
            statusMessage.includes('gagal') || statusMessage.includes('belum')
              ? 'bg-red-50 text-red-700 ring-red-100'
              : 'bg-santara-cream/75 text-santara-roast/70 ring-santara-latte'
          }`}
        >
          {statusMessage || latestLog?.message || 'Belum ada sync.'}
        </p>
      </div>
    </section>
  );
}

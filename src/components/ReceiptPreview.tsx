import type { CompletedTransaction, TransactionItem } from '../types';
import { formatRupiah } from '../utils/format';
import { useState } from 'react';

const LOGO_SRC = '/assets/santara-logo-receipt.jpg';
const WIFI_PASSWORD = 'chillwithsantara';

type ReceiptPreviewProps = {
  transaction: CompletedTransaction;
  isReprint?: boolean;
};

export function ReceiptPreview({
  isReprint = false,
  transaction,
}: ReceiptPreviewProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const itemDiscountAmount = transaction.itemDiscountAmount ?? 0;
  const transactionDiscountAmount =
    transaction.transactionDiscountAmount ??
    Math.max(transaction.discountAmount - itemDiscountAmount, 0);
  const receiptDate = new Date(transaction.dateTime);
  const voidedDate = transaction.voidedAt ? new Date(transaction.voidedAt) : null;

  return (
    <section className="receipt-print-area rounded-lg bg-white p-3 shadow-soft ring-1 ring-santara-latte">
      <article className="receipt-paper mx-auto bg-white text-[#1d1713]">
        <header className="receipt-header">
          <img
            alt="Santara Coffee"
            className={logoFailed ? 'receipt-logo receipt-logo-hidden' : 'receipt-logo'}
            onError={() => setLogoFailed(true)}
            src={LOGO_SRC}
          />
          {logoFailed && <p className="receipt-logo-fallback">SANTARA COFFEE</p>}
          <p className="receipt-brand">SANTARA COFFEE</p>
          <p className="receipt-slogan">Ruang untuk cerita, jeda untuk jiwa</p>
          <ReceiptDivider />
          {isReprint && <ReceiptBadge>CETAK ULANG</ReceiptBadge>}
          {transaction.status === 'voided' && (
            <ReceiptBadge tone="danger">STRUK DIBATALKAN</ReceiptBadge>
          )}
        </header>

        <section className="receipt-meta" aria-label="Informasi struk">
          <ReceiptInfoRow label="No. Struk" value={transaction.receiptNumber} />
          <ReceiptInfoRow label="Tanggal" value={formatReceiptDateOnly(receiptDate)} />
          <ReceiptInfoRow label="Waktu" value={formatReceiptTimeOnly(receiptDate)} />
          <ReceiptInfoRow label="Kasir" value={transaction.cashierName} />
          <ReceiptInfoRow label="Pembayaran" value={transaction.paymentMethod} />
        </section>

        {transaction.status === 'voided' && (
          <section className="receipt-void-box" aria-label="Informasi pembatalan">
            <p className="receipt-void-title">STRUK DIBATALKAN</p>
            <ReceiptInfoRow
              label="Alasan"
              value={transaction.voidReason ?? '-'}
            />
            <ReceiptInfoRow label="Oleh" value={transaction.voidedBy ?? '-'} />
            <ReceiptInfoRow
              label="Waktu"
              value={voidedDate ? formatReceiptDateTime(voidedDate) : '-'}
            />
          </section>
        )}

        <ReceiptRule />

        <section aria-label="Daftar item">
          <div className="receipt-table-head">
            <span>ITEM</span>
            <span>QTY</span>
            <span>HARGA</span>
            <span>TOTAL</span>
          </div>
          <ReceiptRule />
          <div className="receipt-items">
            {transaction.items.map((item, index) => (
              <ReceiptItem item={item} key={`${item.id}-${index}`} />
            ))}
          </div>
        </section>

        <ReceiptRule />

        <section className="receipt-totals" aria-label="Ringkasan pembayaran">
          <ReceiptAmountRow
            label="Subtotal"
            value={formatReceiptMoney(transaction.subtotalBeforeDiscount)}
          />
          {itemDiscountAmount > 0 && (
            <ReceiptAmountRow
              label="Diskon Item"
              value={`-${formatReceiptMoney(itemDiscountAmount)}`}
            />
          )}
          {transactionDiscountAmount > 0 && (
            <ReceiptAmountRow
              label="Diskon Transaksi"
              value={`-${formatReceiptMoney(transactionDiscountAmount)}`}
            />
          )}
          {transaction.discountAmount > 0 && (
            <ReceiptAmountRow
              label="Total Diskon"
              value={`-${formatReceiptMoney(transaction.discountAmount)}`}
            />
          )}
          <div className="receipt-total-line" />
          <ReceiptAmountRow
            label="TOTAL"
            strong
            value={formatReceiptMoney(transaction.totalAfterDiscount)}
          />
          {transaction.paymentMethod === 'Cash' && (
            <>
              <ReceiptRule compact />
              <ReceiptAmountRow
                label="Bayar"
                value={formatReceiptMoney(transaction.paidAmount ?? 0)}
              />
              <ReceiptRule compact />
              <ReceiptAmountRow
                label="Kembalian"
                value={formatReceiptMoney(transaction.changeAmount ?? 0)}
              />
            </>
          )}
        </section>

        <ReceiptRule />

        <section className="receipt-wifi" aria-label="WiFi Santara">
          <p>WiFi Santara</p>
          <p>Password: {WIFI_PASSWORD}</p>
        </section>

        <footer className="receipt-footer">
          <ReceiptDivider variant="wave" />
          <p>Terima kasih sudah mampir ke Santara</p>
          <p>Sampai jumpa lagi</p>
          <p className="receipt-footer-dots">. . . . .</p>
        </footer>
      </article>
    </section>
  );
}

type ReceiptItemProps = {
  item: TransactionItem;
};

function ReceiptItem({ item }: ReceiptItemProps) {
  const grossLineTotal =
    item.grossLineTotal ?? item.subtotal ?? item.unitPriceSnapshot * item.quantity;
  const itemDiscountAmount = item.itemDiscountAmount ?? 0;

  return (
    <div className="receipt-item">
      <p className="receipt-item-name">{item.nameSnapshot}</p>
      <div className="receipt-item-line">
        <span>{item.quantity}</span>
        <span>{formatReceiptMoney(item.unitPriceSnapshot)}</span>
        <span>{formatReceiptMoney(grossLineTotal)}</span>
      </div>
      {itemDiscountAmount > 0 && (
        <div className="receipt-discount-line">
          <span>Diskon Item</span>
          <span>-{formatReceiptMoney(itemDiscountAmount)}</span>
        </div>
      )}
    </div>
  );
}

type ReceiptInfoRowProps = {
  label: string;
  value: string;
};

function ReceiptInfoRow({ label, value }: ReceiptInfoRowProps) {
  return (
    <div className="receipt-info-row">
      <span>{label}</span>
      <span>:</span>
      <span>{value}</span>
    </div>
  );
}

type ReceiptAmountRowProps = {
  label: string;
  value: string;
  strong?: boolean;
};

function ReceiptAmountRow({
  label,
  strong = false,
  value,
}: ReceiptAmountRowProps) {
  return (
    <div className={strong ? 'receipt-amount-row receipt-amount-row-strong' : 'receipt-amount-row'}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

type ReceiptBadgeProps = {
  children: string;
  tone?: 'default' | 'danger';
};

function ReceiptBadge({ children, tone = 'default' }: ReceiptBadgeProps) {
  return (
    <p className={tone === 'danger' ? 'receipt-badge receipt-badge-danger' : 'receipt-badge'}>
      {children}
    </p>
  );
}

type ReceiptDividerProps = {
  variant?: 'dots' | 'wave';
};

function ReceiptDivider({ variant = 'dots' }: ReceiptDividerProps) {
  return (
    <div className={`receipt-divider receipt-divider-${variant}`} aria-hidden="true">
      <span />
    </div>
  );
}

type ReceiptRuleProps = {
  compact?: boolean;
};

function ReceiptRule({ compact = false }: ReceiptRuleProps) {
  return <div className={compact ? 'receipt-rule receipt-rule-compact' : 'receipt-rule'} />;
}

function formatReceiptMoney(value: number) {
  return formatRupiah(value).replace(/^Rp\s?/, '');
}

function formatReceiptDateOnly(date: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatReceiptTimeOnly(date: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatReceiptDateTime(date: Date) {
  return `${formatReceiptDateOnly(date)}, ${formatReceiptTimeOnly(date)}`;
}

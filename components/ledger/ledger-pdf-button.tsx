'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LedgerCustomer, LedgerTransaction } from '@/lib/ledger';
import { paymentMethodLabel } from '@/lib/ledger';

const dark: [number, number, number] = [28, 28, 28];
const muted: [number, number, number] = [82, 82, 82];
const border: [number, number, number] = [125, 125, 125];
const inr = (value: number | null) =>
  value === null
    ? '-'
    : `Rs. ${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const date = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
const time = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));

async function trimmedLogo(src: string) {
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Logo could not be loaded.'));
      element.src = src;
    });
    const source = document.createElement('canvas');
    source.width = image.naturalWidth;
    source.height = image.naturalHeight;
    const sourceContext = source.getContext('2d', { willReadFrequently: true });
    if (!sourceContext) return null;
    sourceContext.drawImage(image, 0, 0);
    const pixels = sourceContext.getImageData(0, 0, source.width, source.height);
    let minX = source.width;
    let minY = source.height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        if (pixels.data[(y * source.width + x) * 4 + 3] > 12) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (minX > maxX || minY > maxY) return null;
    const padding = 4;
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropWidth = Math.min(source.width - cropX, maxX - minX + 1 + padding * 2);
    const cropHeight = Math.min(source.height - cropY, maxY - minY + 1 + padding * 2);
    const output = document.createElement('canvas');
    output.width = cropWidth;
    output.height = cropHeight;
    const outputContext = output.getContext('2d');
    if (!outputContext) return null;
    outputContext.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return { dataUrl: output.toDataURL('image/png'), ratio: cropWidth / cropHeight };
  } catch {
    return null;
  }
}

export function LedgerPdfButton({
  customer,
  transactions,
  totals,
  period,
}: {
  customer: LedgerCustomer;
  transactions: LedgerTransaction[];
  totals: { totalBills: number; totalBilling: number; totalPaid: number; outstanding: number };
  period: string;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const [{ jsPDF }, logo] = await Promise.all([
        import('jspdf'),
        trimmedLogo('/safawala-wordmark-transparent.png'),
      ]);
      const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
        orientation: 'landscape',
        encryption: {
          userPassword: '',
          ownerPassword: crypto.randomUUID().replaceAll('-', ''),
          userPermissions: ['print', 'copy'],
        },
      });
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();
      const left = 12;
      const right = width - 12;
      const columns = [
        { label: 'Date', x: left, w: 20, align: 'left' as const },
        { label: 'Time', x: left + 20, w: 19, align: 'left' as const },
        { label: 'Bill No.', x: left + 39, w: 36, align: 'left' as const },
        { label: 'Type', x: left + 75, w: 17, align: 'left' as const },
        { label: 'Transaction', x: left + 92, w: 23, align: 'left' as const },
        { label: 'Bill Amount', x: left + 115, w: 28, align: 'right' as const },
        { label: 'Payment', x: left + 143, w: 27, align: 'right' as const },
        { label: 'Mode', x: left + 170, w: 25, align: 'left' as const },
        { label: 'Reference', x: left + 195, w: 28, align: 'left' as const },
        { label: 'Balance', x: left + 223, w: 28, align: 'right' as const },
        { label: 'Status', x: left + 251, w: 22, align: 'left' as const },
      ];
      let y = 0;

      const footer = (pageNumber: number, totalPages: number) => {
        doc.setDrawColor(...border);
        doc.setLineWidth(0.25);
        doc.line(left, height - 10, right, height - 10);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...muted);
        const generated = new Intl.DateTimeFormat('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Kolkata',
        }).format(new Date());
        doc.text(`Generated ${generated} - Computer generated statement`, left, height - 5.5);
        doc.text(`Safawala - Page ${pageNumber} of ${totalPages}`, right, height - 5.5, { align: 'right' });
      };

      const tableHeader = () => {
        doc.setFillColor(245, 245, 245);
        doc.setDrawColor(...border);
        doc.rect(left, y, right - left, 8, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.4);
        doc.setTextColor(...dark);
        columns.forEach((column) =>
          doc.text(
            column.label,
            column.align === 'right' ? column.x + column.w - 1.5 : column.x + 1.5,
            y + 5.5,
            { align: column.align },
          ),
        );
        y += 8.5;
      };

      const firstHeader = () => {
        doc.setDrawColor(...border);
        doc.setLineWidth(0.4);
        doc.roundedRect(10, 8, width - 20, 29, 3, 3, 'S');
        if (logo) {
          const logoHeight = 14;
          doc.addImage(logo.dataUrl, 'PNG', left + 2, 11.5, logoHeight * logo.ratio, logoHeight);
        }
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...dark);
        doc.setFontSize(15);
        doc.text('CUSTOMER LEDGER', right - 2, 17, { align: 'right' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...muted);
        doc.text('Premium Wedding Accessories', left + 2, 33);
        doc.text(period, right - 2, 23, { align: 'right' });

        y = 43;
        doc.setFontSize(8.5);
        doc.setTextColor(...dark);
        doc.setFont('helvetica', 'bold');
        doc.text(customer.name, left + 2, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...muted);
        doc.text(`Customer ID: ${customer.id}   Mobile: ${customer.phone}`, left + 2, y + 5);
        doc.text(customer.email || 'Email not available', left + 2, y + 10);
        const summaryX = 128;
        const summary = [
          ['Total Billing', totals.totalBilling],
          ['Total Received', totals.totalPaid],
          ['Outstanding', totals.outstanding],
          ['Total Bills', totals.totalBills],
        ] as const;
        summary.forEach(([label, value], index) => {
          const x = summaryX + index * 39;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...muted);
          doc.setFontSize(7);
          doc.text(label.toUpperCase(), x, y);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...dark);
          doc.setFontSize(9.5);
          doc.text(label === 'Total Bills' ? String(value) : inr(Number(value)), x, y + 6);
        });
        y += 18;
        tableHeader();
      };

      firstHeader();
      for (const transaction of transactions) {
        if (y + 10 > height - 13) {
          doc.addPage('a4', 'landscape');
          y = 11;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(...dark);
          doc.text(`CUSTOMER LEDGER - ${customer.name}`, left, y);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(...muted);
          doc.text(period, right, y, { align: 'right' });
          y += 4;
          tableHeader();
        }
        const values = [
          date(transaction.occurredAt),
          time(transaction.occurredAt),
          transaction.bookingNumber,
          transaction.bookingType === 'sale' ? 'Sale' : 'Rental',
          transaction.transactionType === 'bill' ? 'Bill' : 'Payment',
          inr(transaction.billAmount),
          inr(transaction.paymentAmount),
          paymentMethodLabel(transaction.paymentMethod),
          transaction.referenceNumber || '-',
          inr(transaction.balance),
          transaction.status === 'completed' ? 'Paid' : 'Due',
        ];
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(...dark);
        columns.forEach((column, index) => {
          const clipped = doc.splitTextToSize(values[index], column.w - 3)[0] || '-';
          doc.text(
            clipped,
            column.align === 'right' ? column.x + column.w - 1.5 : column.x + 1.5,
            y + 6,
            { align: column.align },
          );
          if (index > 0) {
            doc.setDrawColor(232, 232, 232);
            doc.setLineWidth(0.15);
            doc.line(column.x, y, column.x, y + 9);
          }
        });
        doc.setDrawColor(215, 215, 215);
        doc.line(left, y + 9, right, y + 9);
        y += 9;
      }
      if (!transactions.length) {
        doc.setFontSize(9);
        doc.setTextColor(...muted);
        doc.text('No transactions match the selected ledger period.', left + 2, y + 8);
      }
      const totalPages = doc.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        doc.setPage(pageNumber);
        footer(pageNumber, totalPages);
      }
      const safeName = customer.name.trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
      const filename = `${safeName || 'Customer'}_Ledger.pdf`;
      const blobUrl = URL.createObjectURL(doc.output('blob'));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={download} disabled={busy}>
      <Download />
      <span className="hidden sm:inline">Download PDF</span>
    </Button>
  );
}

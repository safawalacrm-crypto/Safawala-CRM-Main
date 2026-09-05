'use client';

import { useState } from 'react';
import { FileText, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { friendlyDate, friendlyTime } from '@/lib/bookings';

export type PackingSlipDetails = {
  jobId: string;
  bookingNumber: string;
  customerName: string;
  customerPhone: string;
  eventName: string;
  eventDate: string;
  eventTime: string | null;
  venue: string | null;
};

export type PackingSlipItem = {
  itemName: string;
  quantity: number;
  barcode: string | null;
};

export function PackingSlipButton({ details, items }: { details: PackingSlipDetails; items: PackingSlipItem[] }) {
  const [creating, setCreating] = useState(false);

  async function createSlip() {
    setCreating(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const left = 16;
      const right = 194;
      const width = right - left;

      doc.setDrawColor(166, 111, 44);
      doc.setFillColor(250, 246, 240);
      doc.roundedRect(left, 14, width, 32, 3, 3, 'FD');
      doc.setTextColor(112, 72, 28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('SAFAWALA', left + 6, 27);
      doc.setFontSize(12);
      doc.text('QC & PACKING SLIP', right - 6, 27, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(95, 88, 80);
      doc.text(`${details.jobId} - ${details.bookingNumber}`, right - 6, 36, { align: 'right' });

      let y = 56;
      const row = (label: string, value: string, x: number, rowWidth: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(70, 64, 58);
        doc.text(label, x, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(35, 32, 29);
        doc.text(doc.splitTextToSize(value || '-', rowWidth - 30), x + 29, y);
      };
      row('Customer', details.customerName, left, width / 2);
      row('Phone', details.customerPhone || '-', left + width / 2, width / 2);
      y += 8;
      row('Event', details.eventName, left, width / 2);
      row('Date', `${friendlyDate(details.eventDate)}${details.eventTime ? ` - ${friendlyTime(details.eventTime)}` : ''}`, left + width / 2, width / 2);
      y += 8;
      row('Venue', details.venue || '-', left, width);

      y += 12;
      doc.setFillColor(245, 234, 216);
      doc.rect(left, y - 5, width, 9, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(112, 72, 28);
      doc.setFontSize(9);
      doc.text('PACKED ITEM', left + 3, y);
      doc.text('BARCODE', left + 110, y);
      doc.text('QTY', right - 3, y, { align: 'right' });
      y += 8;

      doc.setFontSize(9);
      items.forEach((item, index) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const lines = doc.splitTextToSize(item.itemName, 100) as string[];
        const height = Math.max(9, lines.length * 4.5 + 3);
        if (index % 2 === 0) {
          doc.setFillColor(252, 250, 247);
          doc.rect(left, y - 5, width, height, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(35, 32, 29);
        doc.text(lines, left + 3, y);
        doc.text(item.barcode || '-', left + 110, y);
        doc.text(String(item.quantity), right - 3, y, { align: 'right' });
        y += height;
        doc.setDrawColor(225, 218, 208);
        doc.line(left, y - 5, right, y - 5);
      });

      y = Math.min(Math.max(y + 12, 235), 270);
      doc.setDrawColor(145, 136, 126);
      doc.line(left, y, left + 55, y);
      doc.line(right - 55, y, right, y);
      doc.setTextColor(95, 88, 80);
      doc.setFontSize(8);
      doc.text('Packed by', left, y + 5);
      doc.text('Received by', right - 55, y + 5);
      doc.text(`Generated ${new Date().toLocaleString('en-IN')}`, left, 290);
      doc.text('Safawala QC & Packing', right, 290, { align: 'right' });
      doc.save(`Packing-Slip-${details.bookingNumber}.pdf`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Button type="button" variant="outline" disabled={creating || items.length === 0} onClick={createSlip}>
      {creating ? <LoaderCircle className="animate-spin" /> : <FileText />}
      {creating ? 'Preparing…' : 'Packing slip'}
    </Button>
  );
}

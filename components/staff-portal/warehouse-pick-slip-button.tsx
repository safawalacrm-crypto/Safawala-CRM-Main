'use client';

import { useState } from 'react';
import { LoaderCircle, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { friendlyDate, friendlyTime } from '@/lib/bookings';

export type WarehousePickSlipDetails = {
  jobId: string;
  bookingNumber: string;
  customerName: string;
  customerPhone: string;
  eventName: string;
  eventDate: string;
  eventTime: string | null;
  venue: string | null;
};

export type WarehousePickSlipItem = {
  itemName: string;
  quantity: number;
  barcode: string | null;
  picked: boolean;
};

export function WarehousePickSlipButton({
  details,
  items,
  disabled = false,
}: {
  details: WarehousePickSlipDetails;
  items: WarehousePickSlipItem[];
  disabled?: boolean;
}) {
  const [creating, setCreating] = useState(false);

  async function createSlip() {
    setCreating(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const drawSlip = (top: number) => {
        const left = 12;
        const right = 198;
        const width = right - left;
        doc.setDrawColor(166, 111, 44);
        doc.setFillColor(250, 246, 240);
        doc.roundedRect(left, top, width, 133, 2, 2, 'FD');
        doc.setTextColor(112, 72, 28);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('SAFAWALA', left + 5, top + 10);
        doc.setFontSize(8);
        doc.text('WAREHOUSE PICK SLIP', right - 5, top + 10, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(95, 88, 80);
        doc.text(`${details.jobId}  |  ${details.bookingNumber}`, right - 5, top + 17, { align: 'right' });

        let y = top + 27;
        const row = (label: string, value: string, x: number, rowWidth: number) => {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(70, 64, 58);
          doc.setFontSize(6.5);
          doc.text(label, x, y);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(35, 32, 29);
          doc.text(doc.splitTextToSize(value || '-', rowWidth - 25) as string[], x + 25, y);
        };
        row('Customer', details.customerName, left + 3, width / 2);
        row('Phone', details.customerPhone || '-', left + width / 2, width / 2);
        y += 6;
        row('Event', details.eventName, left + 3, width / 2);
        row('Date', `${friendlyDate(details.eventDate)}${details.eventTime ? ` · ${friendlyTime(details.eventTime)}` : ''}`, left + width / 2, width / 2);
        y += 6;
        row('Venue', details.venue || '-', left + 3, width);
        y += 8;
        doc.setFillColor(245, 234, 216);
        doc.rect(left + 2, y - 4, width - 4, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(112, 72, 28);
        doc.setFontSize(6.5);
        doc.text('ITEM', left + 5, y);
        doc.text('BARCODE', left + 100, y);
        doc.text('QTY', left + 150, y, { align: 'right' });
        doc.text('STATUS', right - 5, y, { align: 'right' });
        y += 6;
        doc.setFontSize(6.5);
        items.forEach((item, index) => {
          const itemLines = doc.splitTextToSize(item.itemName, 90) as string[];
          const height = Math.max(6, itemLines.length * 3 + 2);
          if (y < top + 116) {
            if (index % 2 === 0) {
              doc.setFillColor(252, 250, 247);
              doc.rect(left + 2, y - 4, width - 4, height, 'F');
            }
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(35, 32, 29);
            doc.text(itemLines, left + 5, y);
            doc.text(item.barcode || '-', left + 100, y);
            doc.text(String(item.quantity), left + 150, y, { align: 'right' });
            doc.setTextColor(item.picked ? 25 : 151, item.picked ? 119 : 91, item.picked ? 82 : 38);
            doc.text(item.picked ? 'PICKED' : 'NOT PICKED', right - 5, y, { align: 'right' });
            y += height;
            doc.setDrawColor(225, 218, 208);
            doc.line(left + 2, y - 3, right - 2, y - 3);
          }
        });
        doc.setDrawColor(145, 136, 126);
        doc.line(left + 5, top + 121, left + 55, top + 121);
        doc.line(right - 55, top + 121, right - 5, top + 121);
        doc.setTextColor(95, 88, 80);
        doc.setFontSize(6);
        doc.text('Picked by', left + 5, top + 126);
        doc.text('Checked by', right - 55, top + 126);
      };

      // Two identical copies, stacked on one A4 page for warehouse handover.
      drawSlip(7);
      drawSlip(151);
      doc.save(`Pick-Slip-${details.bookingNumber}.pdf`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Button type="button" variant="outline" disabled={disabled || creating} onClick={createSlip}>
      {creating ? <LoaderCircle className="animate-spin" /> : <Printer />}
      {creating ? 'Preparing…' : 'Pick slip'}
    </Button>
  );
}

'use client';

import { useState } from 'react';
import { FileCheck2, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { friendlyDate } from '@/lib/bookings';

export type ReturnSlipDetails = {
  jobId: string;
  bookingNumber: string;
  customerName: string;
  eventName: string;
  eventDate: string;
  completedBy: string;
  completedAt: string;
};

type ReturnQcSlipItem = {
  itemName: string;
  returnedQuantity: number;
  goodQuantity: number;
  damagedQuantity: number;
  remarks: string;
};

type ReturnWarehouseSlipItem = {
  itemName: string;
  usableQuantity: number;
  damagedRepairQuantity: number;
  missingLostQuantity: number;
  storageLocation: string;
  remarks: string;
};

async function downloadSlip(
  title: string,
  details: ReturnSlipDetails,
  headings: string[],
  rows: string[][],
  filename: string,
) {
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
  doc.setFontSize(11);
  doc.text(title, right - 6, 27, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(95, 88, 80);
  doc.text(`${details.jobId} | ${details.bookingNumber}`, right - 6, 36, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(35, 32, 29);
  doc.text(`Customer: ${details.customerName}`, left, 57);
  doc.text(`Event: ${details.eventName}`, left, 65);
  doc.text(`Event date: ${friendlyDate(details.eventDate)}`, right, 57, { align: 'right' });
  doc.text(`Completed by: ${details.completedBy}`, right, 65, { align: 'right' });

  let y = 79;
  const columnWidth = width / headings.length;
  doc.setFillColor(245, 234, 216);
  doc.rect(left, y - 5, width, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(112, 72, 28);
  headings.forEach((heading, index) => doc.text(heading, left + 3 + columnWidth * index, y));
  y += 8;

  rows.forEach((row, rowIndex) => {
    const wrapped = row.map((value) => doc.splitTextToSize(value || '-', columnWidth - 5) as string[]);
    const height = Math.max(10, ...wrapped.map((lines) => lines.length * 4 + 3));
    if (y + height > 280) {
      doc.addPage();
      y = 20;
    }
    if (rowIndex % 2 === 0) {
      doc.setFillColor(252, 250, 247);
      doc.rect(left, y - 5, width, height, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(35, 32, 29);
    wrapped.forEach((lines, index) => doc.text(lines, left + 3 + columnWidth * index, y));
    y += height;
  });

  doc.setTextColor(95, 88, 80);
  doc.setFontSize(8);
  doc.text(`Completed ${new Date(details.completedAt).toLocaleString('en-IN')}`, left, 290);
  doc.text('Safawala Event Operations', right, 290, { align: 'right' });
  doc.save(filename);
}

export function ReturnQcSlipButton({ details, items }: { details: ReturnSlipDetails; items: ReturnQcSlipItem[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      disabled={creating}
      onClick={async () => {
        setCreating(true);
        try {
          await downloadSlip(
            'RETURN QC SLIP',
            details,
            ['PRODUCT', 'RETURNED', 'GOOD', 'DAMAGED', 'REMARK'],
            items.map((item) => [item.itemName, String(item.returnedQuantity), String(item.goodQuantity), String(item.damagedQuantity), item.remarks]),
            `Return-QC-${details.bookingNumber}.pdf`,
          );
        } finally {
          setCreating(false);
        }
      }}
    >
      {creating ? <LoaderCircle className="animate-spin" /> : <FileCheck2 />}
      {creating ? 'Preparing…' : 'Return QC slip'}
    </Button>
  );
}

export function ReturnWarehouseSlipButton({ details, items }: { details: ReturnSlipDetails; items: ReturnWarehouseSlipItem[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      disabled={creating}
      onClick={async () => {
        setCreating(true);
        try {
          await downloadSlip(
            'RETURN WAREHOUSE RECEIPT',
            details,
            ['PRODUCT', 'USABLE', 'REPAIR', 'MISSING', 'LOCATION'],
            items.map((item) => [item.itemName, String(item.usableQuantity), String(item.damagedRepairQuantity), String(item.missingLostQuantity), item.storageLocation || item.remarks]),
            `Return-Warehouse-${details.bookingNumber}.pdf`,
          );
        } finally {
          setCreating(false);
        }
      }}
    >
      {creating ? <LoaderCircle className="animate-spin" /> : <FileCheck2 />}
      {creating ? 'Preparing…' : 'Receiving slip'}
    </Button>
  );
}

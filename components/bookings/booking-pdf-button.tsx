'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BOOKING_TERMS, friendlyDate, friendlyTime } from '@/lib/bookings';

export type PdfBooking = {
  booking_number: string;
  booking_type: string;
  is_quote?: boolean;
  status?: string;
  event_name: string;
  event_date: string;
  event_time: string | null;
  event_location: string | null;
  pickup_date: string | null;
  due_date: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  security_deposit: number;
  total: number;
  paid_amount: number;
  balance_amount: number;
  customers: { name: string; phone: string; address?: string | null } | null;
  booking_items: {
    item_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    product_id?: number | null;
    products?: { image_urls: string[] | null } | null;
  }[];
};

// Safawala's own bank details, printed on every generated invoice/quote.
const BANK_DETAILS = {
  bank: 'ICICI Bank',
  accountHolder: 'Mr. Ronak Dave',
  accountNumber: '187501504458',
  ifsc: 'ICIC0001396',
  branch: 'Vadodara',
  upi: '7020926385@okbizaxis',
};

const BRAND_DARK: [number, number, number] = [24, 24, 24];
const BRAND_MID: [number, number, number] = [52, 52, 52];
const BRAND_GOLD: [number, number, number] = [24, 24, 24];
const BORDER_SOFT: [number, number, number] = [92, 92, 92];
const MUTED: [number, number, number] = [78, 78, 78];

const amount = (value: number) =>
  `Rs. ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function drawBrandBanner(
  doc: import('jspdf').jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...BORDER_SOFT);
  doc.setLineWidth(0.45);
  doc.roundedRect(x, y, w, h, 3, 3, 'FD');
}
function sectionBox(
  doc: import('jspdf').jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.setDrawColor(...BORDER_SOFT);
  doc.setLineWidth(0.4);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

// Recolors a black-on-transparent logo PNG to a solid brand color, so the
// same sidebar logo can be reused, tinted for a dark or light background.
async function recolorLogo(
  src: string,
  color: [number, number, number],
): Promise<{ dataUrl: string; ratio: number } | null> {
  try {
    const img = await loadImage(src);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      ratio: canvas.width / canvas.height,
    };
  } catch {
    return null;
  }
}

async function toDataUrl(src: string): Promise<string | null> {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Crops a fetched product photo into a small rounded-corner square so it
// sits neatly inline with each invoice line item.
async function roundedThumbnail(
  dataUrl: string,
  size = 120,
  radius = 22,
): Promise<string | null> {
  try {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.arcTo(size, 0, size, size, radius);
    ctx.arcTo(size, size, 0, size, radius);
    ctx.arcTo(0, size, 0, 0, radius);
    ctx.arcTo(0, 0, size, 0, radius);
    ctx.closePath();
    ctx.clip();
    const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export function BookingPdfButton({ booking }: { booking: PdfBooking }) {
  const [busy, setBusy] = useState(false);

  async function downloadPdf() {
    setBusy(true);
    try {
      const [{ jsPDF }, QRCode] = await Promise.all([
        import('jspdf'),
        import('qrcode'),
      ]);
      const isQuote = Boolean(booking.is_quote && booking.status === 'draft');
      const docLabel = isQuote
        ? 'QUOTATION'
        : `${booking.booking_type.toUpperCase()} INVOICE`;

      // Preload the logo (recolored for a dark banner) and every product
      // thumbnail referenced by this booking's items, in parallel.
      const uniqueImageUrls = Array.from(
        new Set(
          booking.booking_items
            .map((item) => item.products?.image_urls?.[0])
            .filter((url): url is string => Boolean(url)),
        ),
      );
      const [logo, signature, qrDataUrl, ...rawProductImages] = await Promise.all([
        recolorLogo('/safawala-crown-dark.png', BRAND_DARK),
        recolorLogo('/ronak-dave-signature.png', BRAND_DARK),
        QRCode.toDataURL(
          `upi://pay?pa=${BANK_DETAILS.upi}&pn=${encodeURIComponent('Safawala')}&am=${Math.max(booking.balance_amount, 0).toFixed(2)}&cu=INR`,
          { margin: 0, scale: 6 },
        ).catch(() => null),
        ...uniqueImageUrls.map((url) => toDataUrl(url)),
      ]);
      const roundedProductImages = await Promise.all(
        rawProductImages.map((dataUrl) =>
          dataUrl ? roundedThumbnail(dataUrl) : Promise.resolve(null),
        ),
      );
      const imageByUrl = new Map(
        uniqueImageUrls.map((url, index) => [url, roundedProductImages[index]]),
      );

      const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
        encryption: {
          userPassword: '',
          ownerPassword: crypto.randomUUID().replaceAll('-', ''),
          userPermissions: ['print', 'copy'],
        },
      });
      const width = doc.internal.pageSize.getWidth();
      const left = 16;
      const right = width - 16;
      let y = 18;
      // The invoice is intentionally composed as a single A4 page. Sections
      // below use compact, content-aware spacing instead of page breaks.
      const ensureSpace = (_height: number) => undefined;

      // ---- Header banner ----
      drawBrandBanner(doc, 10, 10, width - 20, 34);
      if (logo) {
        const logoH = 13;
        const logoW = logoH * logo.ratio;
        doc.addImage(logo.dataUrl, 'PNG', left, 15, logoW, logoH);
      } else {
        doc.setTextColor(...BRAND_DARK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('SAFAWALA', left, 24);
      }
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Premium Wedding Accessories', left, 40);

      doc.setTextColor(...BRAND_DARK);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(booking.booking_number, right, 21, { align: 'right' });
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(docLabel, right, 28, { align: 'right' });
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(
        `Date: ${friendlyDate(new Date().toISOString().slice(0, 10))}`,
        right,
        34,
        { align: 'right' },
      );

      // ---- Customer / event (boxed, aligned to the same margins) ----
      y = 49;
      const addressLines = doc.splitTextToSize(
        booking.customers?.address || 'Address not added',
        74,
      );
      const locationLines = doc.splitTextToSize(
        booking.event_location || 'Location not added',
        74,
      );
      const infoLines = Math.max(addressLines.length, locationLines.length);
      const isRental = booking.booking_type === 'rental';
      const boxH = 25 + (infoLines - 1) * 3.9 + (isRental ? 8 : 0);
      sectionBox(doc, left, y, right - left, boxH);
      const columnGap = 6;
      const columnWidth = (right - left - columnGap) / 2;
      const eventX = left + columnWidth + columnGap;
      doc.setDrawColor(190, 190, 190);
      doc.setLineWidth(0.25);
      doc.line(left + columnWidth + columnGap / 2, y + 5, left + columnWidth + columnGap / 2, y + boxH - 5);

      let by = y + 8;
      doc.setTextColor(...BRAND_MID);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('CUSTOMER', left + 5, by);
      doc.text('EVENT & DELIVERY', eventX + 2, by);
      by += 5.5;
      doc.setFontSize(9.5);
      doc.setTextColor(...BRAND_DARK);
      doc.setFont('helvetica', 'bold');
      doc.text(booking.customers?.name || 'Not added', left + 5, by);
      doc.text(booking.event_name, eventX + 2, by);
      by += 4.6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(booking.customers?.phone || 'Phone not added', left + 5, by);
      doc.text(
        `${friendlyDate(booking.event_date)}${booking.event_time ? `, ${friendlyTime(booking.event_time)}` : ''}`,
        eventX + 2,
        by,
      );
      by += 4.6;
      doc.setTextColor(...MUTED);
      doc.text(addressLines, left + 5, by);
      doc.text(locationLines, eventX + 2, by);
      by += infoLines * 3.9 + 1;

      if (isRental) {
        doc.setTextColor(...BRAND_DARK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('Pickup:', left + 5, by);
        doc.setFont('helvetica', 'normal');
        doc.text(friendlyDate(booking.pickup_date), left + 20, by);
        doc.setFont('helvetica', 'bold');
        doc.text('Return due:', eventX + 2, by);
        doc.setFont('helvetica', 'normal');
        doc.text(
          friendlyDate(booking.due_date),
          eventX + 24,
          by,
        );
      }
      y += boxH + 6;

      // ---- Items table (with rounded product thumbnails) ----
      const nameX = left + 16;
      doc.setFillColor(245, 245, 245);
      doc.rect(left, y, right - left, 7, 'F');
      doc.setDrawColor(...BORDER_SOFT);
      doc.setLineWidth(0.3);
      doc.rect(left, y, right - left, 7, 'S');
      doc.setTextColor(...BRAND_DARK);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Item', nameX, y + 4.8);
      doc.text('Qty', 132, y + 4.8, { align: 'right' });
      doc.text('Rate', 160, y + 4.8, { align: 'right' });
      doc.text('Amount', right - 3, y + 4.8, { align: 'right' });
      y += 7;
      doc.setFont('helvetica', 'normal');
      for (const item of booking.booking_items) {
        const thumbUrl = item.products?.image_urls?.[0];
        const thumb = thumbUrl ? imageByUrl.get(thumbUrl) : null;
        const itemName = doc.splitTextToSize(item.item_name, 62);
        const textHeight = itemName.length * 3.9;
        const rowHeight = Math.max(thumb ? 14 : 8.5, textHeight + 5);
        ensureSpace(rowHeight + 2);
        const rowTop = y;
        const textBaseline = rowTop + rowHeight / 2 + 1.2;
        if (thumb) {
          try {
            const thumbSize = 10.5;
            doc.addImage(
              thumb,
              'PNG',
              left + 2,
              rowTop + (rowHeight - thumbSize) / 2,
              thumbSize,
              thumbSize,
              undefined,
              'FAST',
            );
          } catch {
            // Skip a thumbnail that fails to decode rather than break the PDF.
          }
        }
        doc.setTextColor(...BRAND_DARK);
        doc.text(itemName, nameX, textBaseline);
        doc.text(String(item.quantity), 132, textBaseline, { align: 'right' });
        doc.text(amount(item.unit_price), 160, textBaseline, { align: 'right' });
        doc.text(amount(item.line_total), right - 3, textBaseline, {
          align: 'right',
        });
        y = rowTop + rowHeight;
        doc.setDrawColor(...BORDER_SOFT);
        doc.setLineWidth(0.2);
        doc.line(left, y, right, y);
      }

      ensureSpace(38);
      y += 4;
      const summary = [
        ['Subtotal', booking.subtotal],
        ['Discount', -booking.discount],
        ['Tax / charges', booking.tax],
        ...(booking.booking_type === 'rental'
          ? [['Security deposit', booking.security_deposit] as [string, number]]
          : []),
        ['Total', booking.total],
        ['Paid', booking.paid_amount],
        ['Balance due', booking.balance_amount],
      ] as [string, number][];
      for (const [label, value] of summary) {
        const strong = label === 'Total' || label === 'Balance due';
        doc.setFont('helvetica', strong ? 'bold' : 'normal');
        doc.setTextColor(...(strong ? BRAND_DARK : MUTED));
        doc.text(label, 124, y);
        doc.setTextColor(...BRAND_DARK);
        doc.text(amount(value), right, y, { align: 'right' });
        y += 5.1;
      }

      // ---- Payment details (boxed, with UPI QR) ----
      ensureSpace(37);
      y += 2;
      const payBoxH = 37;
      sectionBox(doc, left, y, right - left, payBoxH);
      let py = y + 7;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...BRAND_MID);
      doc.text('PAYMENT DETAILS', left + 5, py);
      py += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const paymentRows: [string, string][] = [
        ['Bank', BANK_DETAILS.bank],
        ['A/C Holder', BANK_DETAILS.accountHolder],
        ['A/C No.', BANK_DETAILS.accountNumber],
        ['IFSC', BANK_DETAILS.ifsc],
        ['Branch', BANK_DETAILS.branch],
        ['UPI', BANK_DETAILS.upi],
      ];
      for (const [label, value] of paymentRows) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...BRAND_DARK);
        doc.text(`${label}:`, left + 5, py);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...MUTED);
        doc.text(value, left + 33, py);
        py += 4;
      }
      if (qrDataUrl) {
        const qrSize = 22;
        const qrX = right - qrSize - 5;
        const qrY = y + (payBoxH - qrSize - 5) / 2;
        doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...BRAND_MID);
        doc.text('Scan to Pay', qrX + qrSize / 2, qrY + qrSize + 3.6, {
          align: 'center',
        });
      }
      if (signature) {
        const signatureW = 40;
        const signatureH = signatureW / signature.ratio;
        const signatureX = right - 74;
        const signatureY = y + 5;
        doc.addImage(
          signature.dataUrl,
          'PNG',
          signatureX,
          signatureY,
          signatureW,
          signatureH,
          undefined,
          'FAST',
        );
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...BRAND_MID);
        doc.text(
          'Authorized Signatory',
          signatureX + signatureW / 2,
          y + payBoxH - 4,
          { align: 'center' },
        );
      }
      y += payBoxH + 9;

      // ---- Terms (clean numbered list with a hanging indent) ----
      ensureSpace(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...BRAND_DARK);
      doc.text('TERMS & CONDITIONS', left, y);
      y += 2.5;
      doc.setDrawColor(...BORDER_SOFT);
      doc.setLineWidth(0.3);
      doc.line(left, y, right, y);
      y += 4.5;
      const termIndent = 6.5;
      const availableTermsHeight = Math.max(34, 280 - y);
      let termFontSize = 7.2;
      let termLineHeight = 3.35;
      const measuredTerms = () =>
        BOOKING_TERMS.map((term) =>
          doc.splitTextToSize(
            term.replaceAll('₹', 'Rs.'),
            right - left - termIndent,
          ),
        );
      doc.setFontSize(termFontSize);
      let termLines = measuredTerms();
      while (
        termLines.reduce(
          (sum, lines) => sum + lines.length * termLineHeight + 0.7,
          0,
        ) > availableTermsHeight &&
        termFontSize > 6.1
      ) {
        termFontSize -= 0.2;
        termLineHeight -= 0.08;
        doc.setFontSize(termFontSize);
        termLines = measuredTerms();
      }
      BOOKING_TERMS.forEach((term, index) => {
        const safeTerm = term.replaceAll('₹', 'Rs.');
        const lines = termLines[index] ?? doc.splitTextToSize(safeTerm, right - left - termIndent);
        const blockHeight = lines.length * termLineHeight + 0.7;
        ensureSpace(blockHeight);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...BRAND_GOLD);
        doc.text(`${index + 1}.`, left, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...BRAND_DARK);
        doc.text(lines, left + termIndent, y);
        y += blockHeight;
      });

      doc.setDrawColor(...BORDER_SOFT);
      doc.setLineWidth(0.3);
      doc.line(left, 285, right, 285);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text('Thank you for choosing Safawala.', left, 290);
      doc.text('Page 1 of 1', right, 290, { align: 'right' });
      doc.save(`${booking.booking_number}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={downloadPdf}
      disabled={busy}
      title="Download protected PDF"
      aria-label={`Download protected PDF for ${booking.booking_number}`}
    >
      <Download />
      <span className="hidden 2xl:inline">PDF</span>
    </Button>
  );
}

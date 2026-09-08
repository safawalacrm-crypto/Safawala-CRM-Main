'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Eye,
  Pencil,
  Printer,
  Search,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  BookingPdfButton,
  type PdfBooking,
} from '@/components/bookings/booking-pdf-button';
import { friendlyDate, friendlyTime, money, statusTone } from '@/lib/bookings';
import { modificationDetails } from '@/lib/modifications';
import { importantWeddingDaysForMonth } from '@/lib/important-wedding-dates';

export type CalendarBooking = PdfBooking & {
  id: number;
  payment_status: string;
  notes: string | null;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayOfMonth(dateValue: string) {
  return Number(dateValue.slice(-2));
}

function packageSummary(booking: CalendarBooking) {
  if (!booking.booking_items.length) return '—';
  return booking.booking_items
    .map((item) => `${item.item_name} x${item.quantity}`)
    .join(', ');
}

async function printDateList(dateLabel: string, rows: CalendarBooking[]) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const left = 14;
  const right = width - 14;

  doc.setFillColor(24, 24, 24);
  doc.roundedRect(10, 10, width - 20, 18, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('SAFAWALA', left, 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Date list — ${dateLabel}`, right, 21, { align: 'right' });

  let y = 36;
  doc.setTextColor(24, 24, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const headers = ['Customer', 'Phone', 'Package', 'Payment', 'Venue'];
  const colX = [left, left + 40, left + 80, left + 130, left + 160];
  headers.forEach((h, i) => doc.text(h, colX[i], y));
  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(left, y, right, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  rows.forEach((row) => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(row.customers?.name ?? '—', colX[0], y, { maxWidth: 38 });
    doc.text(row.customers?.phone ?? '—', colX[1], y, { maxWidth: 38 });
    doc.text(packageSummary(row), colX[2], y, { maxWidth: 48 });
    doc.text(
      `${money(row.total)} (Due ${money(row.balance_amount)})`,
      colX[3],
      y,
      { maxWidth: 28 },
    );
    doc.text(row.event_location ?? '—', colX[4], y, { maxWidth: 30 });
    y += 8;
  });

  doc.save(`safawala-date-list-${dateLabel.replace(/\s+/g, '-')}.pdf`);
}

export function CalendarDayGrid({
  year,
  month,
  cells,
  bookings,
  modificationBookings,
}: {
  year: number;
  month: number;
  cells: (number | null)[];
  bookings: CalendarBooking[];
  modificationBookings: CalendarBooking[];
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [tab, setTab] = useState<'events' | 'mod'>('events');
  const [search, setSearch] = useState('');
  const importantDays = useMemo(
    () => importantWeddingDaysForMonth(year, month),
    [year, month],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarBooking[]>();
    bookings.forEach((booking) => {
      const day = dayOfMonth(booking.event_date);
      map.set(day, [...(map.get(day) ?? []), booking]);
    });
    return map;
  }, [bookings]);

  const modsByDay = useMemo(() => {
    const map = new Map<number, CalendarBooking[]>();
    modificationBookings.forEach((booking) => {
      const scheduledDate = modificationDetails(booking.notes).scheduledDate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) return;
      const scheduled = new Date(`${scheduledDate}T00:00:00`);
      if (scheduled.getFullYear() !== year || scheduled.getMonth() !== month)
        return;
      const day = scheduled.getDate();
      map.set(day, [...(map.get(day) ?? []), booking]);
    });
    return map;
  }, [modificationBookings, year, month]);

  const dayEvents = selectedDay ? (eventsByDay.get(selectedDay) ?? []) : [];
  const dayMods = selectedDay ? (modsByDay.get(selectedDay) ?? []) : [];
  const activeRows = tab === 'events' ? dayEvents : dayMods;
  const filteredRows = search.trim()
    ? activeRows.filter((row) =>
        `${row.customers?.name ?? ''} ${row.booking_number}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      )
    : activeRows;

  const selectedDate =
    selectedDay !== null ? new Date(year, month, selectedDay) : null;
  const dateLabel = selectedDate
    ? selectedDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '';
  const weekdayLabel = selectedDate
    ? selectedDate.toLocaleDateString('en-IN', { weekday: 'long' })
    : '';

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-[#e4d2b6] bg-[#fffaf1] dark:bg-[#241e17] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#a86f2d] text-white">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="font-semibold text-[#6f481f]">
              Important wedding dates
            </p>
            <p className="text-xs text-muted-foreground">
              Highlighted for planning across every portal calendar.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="w-fit border-[#d9b77f] bg-white dark:bg-card text-[#7c5225]"
        >
          {importantDays.length} this month
        </Badge>
      </div>
      <Card className="gap-0 overflow-x-auto border-border py-0 shadow-level-1 ring-0">
        <div className="grid min-w-[840px] grid-cols-7 border-b bg-[#fcfaf7] dark:bg-[#241e17]">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="px-3 py-3 text-xs font-semibold text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid min-w-[840px] grid-cols-7">
          {cells.map((day, index) => {
            const events = day ? (eventsByDay.get(day) ?? []) : [];
            const mods = day ? (modsByDay.get(day) ?? []) : [];
            const isImportant = day !== null && importantDays.includes(day);
            const hasDetail =
              day !== null &&
              (events.length > 0 || mods.length > 0 || isImportant);
            return (
              <div
                key={index}
                className={`min-h-32 border-b border-r p-2 ${
                  isImportant ? 'bg-[#fff8eb] dark:bg-[#241e17]' : ''
                }`}
              >
                {hasDetail ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDay(day);
                      setTab(events.length || !mods.length ? 'events' : 'mod');
                      setSearch('');
                    }}
                    className={`rounded px-1 text-xs font-semibold hover:underline ${
                      isImportant ? 'text-[#9a6124]' : 'text-primary'
                    }`}
                  >
                    {day}
                  </button>
                ) : (
                  <p className="text-xs font-medium text-muted-foreground">
                    {day}
                  </p>
                )}
                {isImportant ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDay(day);
                      setTab('events');
                      setSearch('');
                    }}
                    className="mt-2 flex w-fit items-center gap-1 rounded-full bg-[#f4e3c7] dark:bg-[#33291c] px-2 py-1 text-left text-[10px] font-semibold text-[#7a4c1d] transition hover:bg-[#ead1aa] dark:hover:bg-[#33291c]"
                  >
                    <Sparkles className="size-3" />
                    Important
                  </button>
                ) : null}
                {events.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedDay(day);
                      setTab('events');
                      setSearch('');
                    }}
                    className="mt-2 block w-full rounded-lg border border-[#e4d2b6] bg-accent p-2 text-left text-xs hover:border-primary"
                  >
                    <span className="block truncate font-semibold">
                      {b.event_name}
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-1 text-muted-foreground">
                      <span>{b.booking_number}</span>
                      <Badge
                        variant="outline"
                        className={`px-1 py-0 text-[10px] ${statusTone(b.status ?? '')}`}
                      >
                        {b.booking_type}
                      </Badge>
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </Card>

      {selectedDay !== null ? (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4 print:hidden">
          <button
            type="button"
            aria-label="Close day details"
            onClick={() => setSelectedDay(null)}
            className="absolute inset-0 bg-[#211d18]/70 backdrop-blur-sm"
          />
          <dialog
            open
            aria-modal="true"
            aria-labelledby="calendar-day-title"
            className="relative z-10 m-0 flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[22px] border border-white/40 bg-[#fffdf9] dark:bg-[#241e17] p-0 text-foreground shadow-[0_32px_90px_rgb(20_15_10_/.35)]"
          >
            <div className="flex items-start justify-between border-b bg-[#fcfaf7] dark:bg-[#241e17] p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-[#181818] text-white">
                  <Calendar className="size-5" />
                </span>
                <div>
                  <h2 id="calendar-day-title" className="text-lg font-semibold">
                    {dateLabel}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {weekdayLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                aria-label="Close day details"
                className="grid size-9 place-items-center rounded-full border bg-white dark:bg-card text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#f3efe9] dark:bg-[#241e17] p-1 mx-5 mt-4">
              <button
                type="button"
                onClick={() => setTab('events')}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  tab === 'events'
                    ? 'bg-white dark:bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-3.5" />
                  Events ({dayEvents.length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTab('mod')}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  tab === 'mod'
                    ? 'bg-white dark:bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Wrench className="size-3.5" />
                  Mod. ({dayMods.length})
                </span>
              </button>
            </div>

            {importantDays.includes(selectedDay) ? (
              <div className="mx-5 mt-4 flex items-center gap-3 rounded-xl border border-[#e5c58f] bg-[#fff8eb] dark:bg-[#241e17] px-4 py-3 text-[#71481e]">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#a86f2d] text-white">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    Important wedding date
                  </p>
                  <p className="text-xs text-[#8a6a48]">
                    Plan staffing, stock and customer follow-ups early.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="relative flex-1 sm:max-w-xs">
                <span className="sr-only">Search name, booking</span>
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, booking…"
                  className="h-10 w-full rounded-lg border bg-white dark:bg-card pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0 bg-white dark:bg-card"
                onClick={() => printDateList(dateLabel, filteredRows)}
                disabled={filteredRows.length === 0}
              >
                <Printer className="size-4" />
                Print Date List ({filteredRows.length})
              </Button>
            </div>

            <div className="overflow-y-auto">
              {filteredRows.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  {tab === 'events'
                    ? 'No bookings for this date.'
                    : 'No modification dispatches scheduled for this date.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="border-b bg-white dark:bg-card text-xs text-muted-foreground">
                      <tr>
                        {[
                          'Customer',
                          'Phone',
                          'Event date & time',
                          'Total safas / package',
                          'Payment',
                          'Venue',
                          'Actions',
                        ].map((h) => (
                          <th key={h} className="px-5 py-3 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b last:border-0 hover:bg-[#fcfaf7] dark:hover:bg-[#241e17]"
                        >
                          <td className="px-5 py-4 font-medium">
                            {row.customers?.name ?? '—'}
                            <span className="mt-1 block">
                              <Badge
                                variant="outline"
                                className="px-1.5 py-0 text-[10px] capitalize"
                              >
                                {row.booking_type}
                              </Badge>
                            </span>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">
                            {row.customers?.phone ?? '—'}
                          </td>
                          <td className="px-5 py-4">
                            {friendlyDate(row.event_date)}
                            {row.event_time ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {friendlyTime(row.event_time)}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-5 py-4">{packageSummary(row)}</td>
                          <td className="px-5 py-4">
                            <p className="font-semibold">{money(row.total)}</p>
                            {row.balance_amount > 0 ? (
                              <p className="text-xs text-amber-700">
                                Due {money(row.balance_amount)}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">
                            {row.event_location ?? '—'}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                render={
                                  <Link
                                    href={`/bookings/${row.id}`}
                                    aria-label={`Preview ${row.booking_number}`}
                                  />
                                }
                                title="Preview booking"
                              >
                                <Eye />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                render={
                                  <Link
                                    href={`/bookings/${row.id}/edit`}
                                    aria-label={`Edit ${row.booking_number}`}
                                  />
                                }
                                title="Edit booking"
                              >
                                <Pencil />
                              </Button>
                              <BookingPdfButton booking={row} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </dialog>
        </div>
      ) : null}
    </>
  );
}

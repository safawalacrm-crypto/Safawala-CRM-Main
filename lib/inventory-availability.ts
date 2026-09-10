import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Product availability for rental bookings.
 *
 * A product's flat `stock_quantity` is the total units owned. For rental
 * bookings we also need to know how many of those units are already
 * promised to OTHER rental bookings during a given pickup->due window, so
 * we can tell staff the real number still free for a new booking, and (if
 * asked) the next date the product frees up.
 *
 * "Available" for a window = totalStock - (busiest single day's reserved
 * quantity inside that window). A reservation holds its units for every
 * day of its own pickup->due span, so the window can only ever offer as
 * many free units as its most-booked day allows.
 */

const ACTIVE_RENTAL_STATUSES = [
  'confirmed',
  'ready',
  'out_for_delivery',
  'active',
  'completed',
] as const;

export type AvailabilityResult = {
  productId: number;
  totalStock: number;
  /** Units already reserved by other rental bookings on the busiest day of the requested window. */
  reserved: number;
  /** Units still free for the whole requested window. */
  available: number;
};

function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}
function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function daySpan(start: string, end: string): string[] {
  const startDate = toUtcDate(start);
  const endDate = toUtcDate(end);
  const dates: string[] = [];
  for (let d = startDate; d.getTime() <= endDate.getTime(); d = addDays(d, 1)) {
    dates.push(toIsoDate(d));
  }
  return dates;
}
const maxDate = (a: string, b: string) => (a > b ? a : b);
const minDate = (a: string, b: string) => (a < b ? a : b);

type BookingJoin = { id: number; pickup_date: string | null; due_date: string | null };
type ReservationRow = {
  product_id: number | null;
  quantity: number;
  bookings: BookingJoin | BookingJoin[] | null;
};

/**
 * Builds a day -> reserved-quantity map for one product across a date range,
 * from every OTHER active rental booking that overlaps that range.
 */
async function loadDailyReserved(params: {
  ownerId: string;
  productId: number;
  rangeStart: string;
  rangeEnd: string;
  excludeBookingId?: number;
}): Promise<Map<string, number>> {
  const { ownerId, productId, rangeStart, rangeEnd, excludeBookingId } = params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('booking_items')
    .select('product_id,quantity,bookings!inner(id,pickup_date,due_date,booking_type,status)')
    .eq('owner_id', ownerId)
    .eq('product_id', productId)
    .eq('bookings.booking_type', 'rental')
    .in('bookings.status', ACTIVE_RENTAL_STATUSES as unknown as string[])
    .lte('bookings.pickup_date', rangeEnd)
    .gte('bookings.due_date', rangeStart);
  if (error) throw error;

  const daily = new Map<string, number>();
  for (const row of (data ?? []) as ReservationRow[]) {
    const booking = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings;
    if (!booking || !booking.pickup_date || !booking.due_date) continue;
    if (excludeBookingId && booking.id === excludeBookingId) continue;
    const overlapStart = maxDate(booking.pickup_date, rangeStart);
    const overlapEnd = minDate(booking.due_date, rangeEnd);
    if (overlapStart > overlapEnd) continue;
    for (const day of daySpan(overlapStart, overlapEnd)) {
      daily.set(day, (daily.get(day) ?? 0) + row.quantity);
    }
  }
  return daily;
}

/**
 * Bulk availability for many products over the SAME pickup->due window
 * (the normal case: staff picking products for one booking).
 */
export async function getAvailabilityForWindow(params: {
  ownerId: string;
  productIds: number[];
  pickupDate: string;
  dueDate: string;
  excludeBookingId?: number;
}): Promise<Map<number, AvailabilityResult>> {
  const { ownerId, productIds, pickupDate, dueDate, excludeBookingId } = params;
  const results = new Map<number, AvailabilityResult>();
  const uniqueIds = Array.from(new Set(productIds));
  if (uniqueIds.length === 0) return results;

  const admin = createAdminClient();
  const { data: products, error: productsError } = await admin
    .from('products')
    .select('id,stock_quantity')
    .eq('owner_id', ownerId)
    .in('id', uniqueIds);
  if (productsError) throw productsError;

  const { data: reservations, error: reservationsError } = await admin
    .from('booking_items')
    .select('product_id,quantity,bookings!inner(id,pickup_date,due_date,booking_type,status)')
    .eq('owner_id', ownerId)
    .in('product_id', uniqueIds)
    .eq('bookings.booking_type', 'rental')
    .in('bookings.status', ACTIVE_RENTAL_STATUSES as unknown as string[])
    .lte('bookings.pickup_date', dueDate)
    .gte('bookings.due_date', pickupDate);
  if (reservationsError) throw reservationsError;

  const windowDates = daySpan(pickupDate, dueDate);
  const dailyByProduct = new Map<number, Map<string, number>>();
  for (const row of (reservations ?? []) as ReservationRow[]) {
    const booking = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings;
    if (!booking || !booking.pickup_date || !booking.due_date) continue;
    if (excludeBookingId && booking.id === excludeBookingId) continue;
    const productId = row.product_id;
    if (productId == null) continue;
    const overlapStart = maxDate(booking.pickup_date, pickupDate);
    const overlapEnd = minDate(booking.due_date, dueDate);
    if (overlapStart > overlapEnd) continue;
    let dayMap = dailyByProduct.get(productId);
    if (!dayMap) {
      dayMap = new Map();
      dailyByProduct.set(productId, dayMap);
    }
    for (const day of daySpan(overlapStart, overlapEnd)) {
      dayMap.set(day, (dayMap.get(day) ?? 0) + row.quantity);
    }
  }

  const stockByProduct = new Map<number, number>();
  for (const product of products ?? []) stockByProduct.set(product.id, product.stock_quantity ?? 0);

  for (const productId of uniqueIds) {
    const totalStock = stockByProduct.get(productId) ?? 0;
    const dayMap = dailyByProduct.get(productId);
    let reserved = 0;
    if (dayMap) {
      for (const day of windowDates) {
        const value = dayMap.get(day) ?? 0;
        if (value > reserved) reserved = value;
      }
    }
    results.set(productId, {
      productId,
      totalStock,
      reserved,
      available: Math.max(totalStock - reserved, 0),
    });
  }
  return results;
}

export async function getAvailabilityForProduct(params: {
  ownerId: string;
  productId: number;
  pickupDate: string;
  dueDate: string;
  excludeBookingId?: number;
}): Promise<AvailabilityResult> {
  const map = await getAvailabilityForWindow({
    ownerId: params.ownerId,
    productIds: [params.productId],
    pickupDate: params.pickupDate,
    dueDate: params.dueDate,
    excludeBookingId: params.excludeBookingId,
  });
  return (
    map.get(params.productId) ?? {
      productId: params.productId,
      totalStock: 0,
      reserved: 0,
      available: 0,
    }
  );
}

const MAX_LOOKAHEAD_DAYS = 60;

/**
 * Slides the same-duration window forward day by day (up to 60 days) and
 * returns the first pickup/due dates where `quantity` units are free.
 * Fetches the product's reservations for the whole lookahead span in one
 * query, then simulates each candidate window in memory.
 */
export async function findNextAvailableWindow(params: {
  ownerId: string;
  productId: number;
  quantity: number;
  pickupDate: string;
  dueDate: string;
  excludeBookingId?: number;
  maxLookaheadDays?: number;
}): Promise<{ pickupDate: string; dueDate: string } | null> {
  const {
    ownerId,
    productId,
    quantity,
    pickupDate,
    dueDate,
    excludeBookingId,
    maxLookaheadDays = MAX_LOOKAHEAD_DAYS,
  } = params;

  const admin = createAdminClient();
  const { data: product, error: productError } = await admin
    .from('products')
    .select('stock_quantity')
    .eq('owner_id', ownerId)
    .eq('id', productId)
    .maybeSingle();
  if (productError) throw productError;
  const totalStock = product?.stock_quantity ?? 0;
  if (quantity > totalStock) return null; // can never fit, regardless of dates

  const start = toUtcDate(pickupDate);
  const end = toUtcDate(dueDate);
  const durationMs = end.getTime() - start.getTime();
  const scanRangeStart = pickupDate;
  const scanRangeEnd = toIsoDate(addDays(end, maxLookaheadDays));

  const daily = await loadDailyReserved({
    ownerId,
    productId,
    rangeStart: scanRangeStart,
    rangeEnd: scanRangeEnd,
    excludeBookingId,
  });

  for (let offset = 1; offset <= maxLookaheadDays; offset++) {
    const candidateStart = addDays(start, offset);
    const candidateEnd = new Date(candidateStart.getTime() + durationMs);
    const candidatePickup = toIsoDate(candidateStart);
    const candidateDue = toIsoDate(candidateEnd);
    let maxReserved = 0;
    for (const day of daySpan(candidatePickup, candidateDue)) {
      const value = daily.get(day) ?? 0;
      if (value > maxReserved) maxReserved = value;
    }
    if (totalStock - maxReserved >= quantity) {
      return { pickupDate: candidatePickup, dueDate: candidateDue };
    }
  }
  return null;
}

export type ProductReservation = {
  productId: number;
  pickupDate: string;
  dueDate: string;
  quantity: number;
  bookingNumber: string;
};

type ReservationJoinRow = {
  product_id: number | null;
  quantity: number;
  bookings:
    | { pickup_date: string | null; due_date: string | null; booking_number: string }
    | { pickup_date: string | null; due_date: string | null; booking_number: string }[]
    | null;
};

/**
 * All current/future reservations (from today onward) across every product,
 * for the Inventory page to show which dates a product is already booked.
 */
export async function getUpcomingReservations(params: {
  ownerId: string;
  fromDate: string;
}): Promise<ProductReservation[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('booking_items')
    .select('product_id,quantity,bookings!inner(pickup_date,due_date,booking_number,booking_type,status)')
    .eq('owner_id', params.ownerId)
    .not('product_id', 'is', null)
    .eq('bookings.booking_type', 'rental')
    .in('bookings.status', ACTIVE_RENTAL_STATUSES as unknown as string[])
    .gte('bookings.due_date', params.fromDate);
  if (error) throw error;

  const results: ProductReservation[] = [];
  for (const row of (data ?? []) as ReservationJoinRow[]) {
    const booking = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings;
    if (!booking?.pickup_date || !booking?.due_date || row.product_id == null) continue;
    results.push({
      productId: row.product_id,
      pickupDate: booking.pickup_date,
      dueDate: booking.due_date,
      quantity: row.quantity,
      bookingNumber: booking.booking_number,
    });
  }
  return results.sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
}

'use server';

import { syncEventJobs } from '@/lib/event-jobs/store';
import type { ConfirmedBookingSummary } from '@/lib/event-jobs/types';
import { createClient } from '@/lib/supabase/server';

type BookingForEventJob = {
  id: number;
  booking_number: string;
  booking_type: string;
  status: string;
  is_quote: boolean;
  event_name: string;
  event_date: string;
  event_time: string | null;
  event_location: string | null;
  total: number;
  paid_amount: number;
  balance_amount: number;
  security_deposit: number;
  payment_status: string;
  booking_items: { item_name: string; quantity: number }[];
};

async function initializeEventJob(bookingId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id,booking_number,booking_type,status,is_quote,event_name,event_date,event_time,event_location,total,paid_amount,balance_amount,security_deposit,payment_status,booking_items(item_name,quantity)',
    )
    .eq('id', bookingId)
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Booking not found.');

  const booking = data as unknown as BookingForEventJob;
  if (booking.is_quote || booking.status !== 'confirmed') {
    throw new Error('Only a confirmed booking can create an Event Job.');
  }

  const summary: ConfirmedBookingSummary = {
    bookingId: booking.id,
    bookingNumber: booking.booking_number,
    bookingType: booking.booking_type,
    status: booking.status,
    eventName: booking.event_name,
    eventDate: booking.event_date,
    eventTime: booking.event_time,
    eventLocation: booking.event_location,
    items: (booking.booking_items ?? []).map((item) => ({
      itemName: item.item_name,
      quantity: item.quantity,
    })),
    payment: {
      totalAmount: Number(booking.total),
      amountReceived: Number(booking.paid_amount),
      pendingBalance: Number(booking.balance_amount),
      depositAmount: Number(booking.security_deposit),
      paymentStatus: booking.payment_status,
    },
  };

  await syncEventJobs([summary]);
}

export async function initializeBookingEventJobAction(bookingId: number) {
  try {
    await initializeEventJob(bookingId);
    return { error: '' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Event Job could not be initialized.' };
  }
}

export async function convertQuoteToBookingAction(quoteId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('convert_quote_to_booking', {
    quote_key: quoteId,
  });
  if (error) return { id: null, error: error.message };

  const bookingId = Number((data as { id?: number } | null)?.id);
  if (!Number.isFinite(bookingId)) {
    return { id: null, error: 'The booking was created without a valid ID.' };
  }

  try {
    await initializeEventJob(bookingId);
    return { id: bookingId, error: '' };
  } catch (initializationError) {
    // Conversion itself has already committed. Return the booking ID so the
    // caller can show success and open the new booking even if the optional
    // Event Job backfill needs attention.
    return {
      id: bookingId,
      error:
        initializationError instanceof Error
          ? initializationError.message
          : 'The booking was created, but its Event Job could not be initialized.',
    };
  }
}

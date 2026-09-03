export type LedgerCustomer = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  created_at: string;
};

export type LedgerPayment = {
  id: number;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  paid_at: string;
  created_at: string;
};

export type LedgerBooking = {
  id: number;
  booking_number: string;
  booking_type: 'sale' | 'rental';
  status: string;
  payment_status: string;
  customer_id: number;
  event_name: string;
  event_date: string;
  total: number;
  paid_amount: number;
  balance_amount: number;
  created_at: string;
  booking_payments: LedgerPayment[];
};

export type LedgerTransaction = {
  key: string;
  id: number;
  bookingId: number;
  bookingNumber: string;
  bookingType: 'sale' | 'rental';
  eventName: string;
  transactionType: 'bill' | 'payment';
  occurredAt: string;
  billAmount: number | null;
  paymentAmount: number | null;
  paymentMethod: string | null;
  referenceNumber: string | null;
  notes: string | null;
  balance: number;
  status: 'completed' | 'uncompleted';
};

export function ledgerTotals(bookings: LedgerBooking[]) {
  const totalBilling = bookings.reduce(
    (sum, booking) => sum + Number(booking.total || 0),
    0,
  );
  const totalPaid = bookings.reduce(
    (sum, booking) =>
      sum +
      booking.booking_payments.reduce(
        (paymentSum, payment) => paymentSum + Number(payment.amount || 0),
        0,
      ),
    0,
  );
  return {
    totalBills: bookings.length,
    totalBilling,
    totalPaid,
    outstanding: Math.max(totalBilling - totalPaid, 0),
  };
}

export function buildLedgerTransactions(bookings: LedgerBooking[]) {
  const raw = bookings.flatMap((booking) => [
    {
      key: `bill-${booking.id}`,
      id: booking.id,
      bookingId: booking.id,
      bookingNumber: booking.booking_number,
      bookingType: booking.booking_type,
      eventName: booking.event_name,
      transactionType: 'bill' as const,
      occurredAt: booking.created_at,
      billAmount: Number(booking.total || 0),
      paymentAmount: null,
      paymentMethod: null,
      referenceNumber: null,
      notes: null,
    },
    ...booking.booking_payments.map((payment) => ({
      key: `payment-${payment.id}`,
      id: payment.id,
      bookingId: booking.id,
      bookingNumber: booking.booking_number,
      bookingType: booking.booking_type,
      eventName: booking.event_name,
      transactionType: 'payment' as const,
      occurredAt: payment.paid_at || payment.created_at,
      billAmount: null,
      paymentAmount: Number(payment.amount || 0),
      paymentMethod: payment.payment_method,
      referenceNumber: payment.reference_number,
      notes: payment.notes,
    })),
  ]);

  raw.sort((a, b) => {
    const byTime = new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
    if (byTime !== 0) return byTime;
    if (a.transactionType !== b.transactionType)
      return a.transactionType === 'bill' ? -1 : 1;
    return a.id - b.id;
  });

  let balance = 0;
  const billBalances = new Map<number, number>();
  return raw.map((transaction): LedgerTransaction => {
    balance += Number(transaction.billAmount || 0);
    balance -= Number(transaction.paymentAmount || 0);
    balance = Math.max(balance, 0);
    const previousBillBalance = billBalances.get(transaction.bookingId) ?? 0;
    const billBalance = Math.max(
      previousBillBalance +
        Number(transaction.billAmount || 0) -
        Number(transaction.paymentAmount || 0),
      0,
    );
    billBalances.set(transaction.bookingId, billBalance);
    return {
      ...transaction,
      balance,
      status: billBalance <= 0 ? 'completed' : 'uncompleted',
    };
  });
}

export function paymentMethodLabel(value: string | null) {
  if (!value) return '—';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

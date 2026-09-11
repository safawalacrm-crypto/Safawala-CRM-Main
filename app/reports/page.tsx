import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ReportsDashboard, type ReportBooking, type ReportProduct } from '@/components/reports/reports-dashboard';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const today = new Date();
  const defaultEnd = dateOnly(today);
  const defaultStart = dateOnly(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
  const start = typeof params.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.start) ? params.start : defaultStart;
  const end = typeof params.end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.end) ? params.end : defaultEnd;
  const safeStart = start <= end ? start : end;
  const safeEnd = start <= end ? end : start;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const [bookingResult, productsResult, customerResult, staffResult, expenseResult] = await Promise.all([
    supabase.from('bookings').select('id,booking_number,booking_type,status,event_date,total,paid_amount,balance_amount,customers(name)').eq('is_quote', false).gte('event_date', safeStart).lte('event_date', safeEnd).order('event_date', { ascending: false }),
    supabase.from('products').select('id,name,category,stock_quantity,sale_price,rental_price,reorder_level,is_active').order('name', { ascending: true }),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('staff_members').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('expenses').select('amount').gte('expense_date', safeStart).lte('expense_date', safeEnd),
  ]);

  const bookings = ((bookingResult.data ?? []) as unknown as ReportBooking[]).map((booking) => ({
    ...booking,
    total: Number(booking.total) || 0,
    paid_amount: Number(booking.paid_amount) || 0,
    balance_amount: Number(booking.balance_amount) || 0,
  }));
  const products = ((productsResult.data ?? []) as unknown as ReportProduct[]).map((product) => ({
    ...product,
    stock_quantity: Number(product.stock_quantity) || 0,
    sale_price: Number(product.sale_price) || 0,
    rental_price: Number(product.rental_price) || 0,
    reorder_level: Number(product.reorder_level) || 0,
  }));
  const expenseTotal = (expenseResult.data ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  return <DashboardShell email={auth.user.email ?? 'Safawala user'}><ReportsDashboard data={{ bookings, products, customerCount: customerResult.count ?? 0, expenseTotal, staffCount: staffResult.count ?? 0, start: safeStart, end: safeEnd }} /></DashboardShell>;
}

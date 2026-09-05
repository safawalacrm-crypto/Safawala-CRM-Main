import { IndianRupee } from 'lucide-react';
import { StaffRecordPage } from '@/components/staff-portal/staff-record-page';
import { Card, CardContent } from '@/components/ui/card';
import { friendlyDate, money } from '@/lib/bookings';
import { requirePermission } from '@/lib/staff-portal/guard';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  const session = await requirePermission('invoices');
  const admin = createAdminClient();
  const { data: staff } = await admin.from('staff_members').select('owner_id').eq('id', session.staffMemberId).single();
  let query = admin.from('bookings').select('id,booking_number,event_name,event_date,total,payment_status,staff_id').eq('owner_id', staff?.owner_id ?? session.id).eq('is_quote', false).not('status', 'in', '(draft,cancelled)').order('created_at', { ascending: false }).limit(100);
  if (!session.isMainId) query = query.eq('staff_id', session.staffMemberId);
  const { data: invoices, error } = await query;
  return <StaffRecordPage session={session} title="My Invoices" subtitle="Booking invoices available to your account" icon={<IndianRupee />} heading="No invoices available" description="Invoices for assigned confirmed bookings will appear here.">
    <Card className="overflow-hidden border-border py-0 shadow-level-1"><CardContent className="p-0">{error ? <p className="p-5 text-sm text-destructive">{error.message}</p> : invoices?.length ? <div className="divide-y divide-border">{invoices.map((invoice) => <div key={invoice.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-primary">{invoice.booking_number}</p><p className="text-sm text-muted-foreground">{invoice.event_name} · {friendlyDate(invoice.event_date)}</p></div><div className="sm:text-right"><p className="font-semibold">{money(Number(invoice.total))}</p><p className="text-xs capitalize text-muted-foreground">{invoice.payment_status}</p></div></div>)}</div> : <div className="grid min-h-52 place-items-center p-8 text-center"><div><IndianRupee className="mx-auto size-9 text-primary" /><h3 className="mt-3 font-semibold">No invoices available</h3><p className="mt-1 text-sm text-muted-foreground">Invoices for assigned confirmed bookings will appear here.</p></div></div>}</CardContent></Card>
  </StaffRecordPage>;
}

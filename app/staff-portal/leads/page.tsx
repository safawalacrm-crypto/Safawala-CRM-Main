import { CalendarClock, UserRound } from 'lucide-react';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { StaffPortalShell } from '@/components/staff-portal/staff-portal-shell';
import { Card, CardContent } from '@/components/ui/card';
import { friendlyDate, money } from '@/lib/bookings';
import { requirePermission } from '@/lib/staff-portal/guard';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function StaffLeadsPage() {
  const session = await requirePermission('leads');
  const admin = createAdminClient();
  const { data: staff } = await admin.from('staff_members').select('owner_id').eq('id', session.staffMemberId).single();
  let query = admin
    .from('bookings')
    .select('id,booking_number,event_name,event_date,total,staff_id,customers(name,phone)')
    .eq('owner_id', staff?.owner_id ?? session.id)
    .eq('is_quote', true)
    .eq('status', 'draft')
    .order('created_at', { ascending: false });
  if (!session.isMainId) query = query.eq('staff_id', session.staffMemberId);
  const { data: leads, error } = await query;

  return <StaffPortalShell name={session.name} departments={session.departments} permissions={session.permissions} isMainId={session.isMainId}>
    <div className="mx-auto max-w-[1440px] space-y-6">
      <DashboardHeader title="My Leads" subtitle="Booking enquiries assigned to your department access" />
      <Card className="overflow-hidden border-border py-0 shadow-level-1">
        <CardContent className="p-0">
          {error ? <p className="p-5 text-sm text-destructive">{error.message}</p> : leads?.length ? (
            <div className="divide-y divide-border">
              {leads.map((lead) => {
                const customer = Array.isArray(lead.customers) ? lead.customers[0] : lead.customers;
                return <div key={lead.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-semibold text-primary">{lead.booking_number}</p><p className="mt-1 flex items-center gap-1.5 text-sm"><UserRound className="size-4 text-muted-foreground" />{customer?.name ?? 'Walk-in'}{customer?.phone ? ` · ${customer.phone}` : ''}</p></div>
                  <div className="sm:text-right"><p className="font-semibold">{money(Number(lead.total))}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock className="size-3.5" />{lead.event_name} · {friendlyDate(lead.event_date)}</p></div>
                </div>;
              })}
            </div>
          ) : <div className="grid min-h-52 place-items-center p-8 text-center"><div><UserRound className="mx-auto size-9 text-primary" /><h3 className="mt-3 font-semibold">No assigned leads</h3><p className="mt-1 text-sm text-muted-foreground">New assigned booking enquiries will appear here.</p></div></div>}
        </CardContent>
      </Card>
    </div>
  </StaffPortalShell>;
}

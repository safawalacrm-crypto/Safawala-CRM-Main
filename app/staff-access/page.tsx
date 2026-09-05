import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StaffAccessPanel } from '@/components/staff/staff-access-panel';
import { listAccounts } from '@/lib/staff-portal/store';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function StaffAccessPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
  if (profile?.role !== 'admin') redirect('/staff-portal');
  const [{ data: staff }, accounts] = await Promise.all([
    supabase.from('staff_members').select('id,name').eq('owner_id', auth.user.id).is('user_id', null).order('name'),
    listAccounts(auth.user.id),
  ]);
  return (
    <DashboardShell email={auth.user.email ?? 'Safawala user'}>
      <StaffAccessPanel staffMembers={staff ?? []} initialAccounts={accounts} />
    </DashboardShell>
  );
}

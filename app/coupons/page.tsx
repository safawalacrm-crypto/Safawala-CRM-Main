import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CouponsManager, type CouponOffer } from '@/components/coupons/coupons-manager';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function CouponsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const { data, error } = await supabase.from('coupon_offers').select('id,code,name,discount_type,value,is_active,created_at').order('created_at', { ascending: false });
  return <DashboardShell email={auth.user.email ?? 'Safawala user'}><CouponsManager offers={(data ?? []) as CouponOffer[]} loadError={error?.message ?? ''} /></DashboardShell>;
}

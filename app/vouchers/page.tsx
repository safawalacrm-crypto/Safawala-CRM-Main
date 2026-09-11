import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { FinanceManager, type FinanceRecord } from '@/components/finance/finance-manager';
import { createClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export default async function VouchersPage() { const supabase = await createClient(); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) redirect('/login'); const { data, error } = await supabase.from('vouchers').select('*').order('voucher_date', { ascending: false }); return <DashboardShell email={auth.user.email ?? 'Safawala user'}><FinanceManager mode="vouchers" initialRecords={(data ?? []) as FinanceRecord[]} loadError={error?.message} email={auth.user.email ?? ''} /></DashboardShell>; }

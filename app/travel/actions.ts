'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { confirmStylistTicketSent } from '@/lib/event-jobs/store';
import { createClient } from '@/lib/supabase/server';

async function requireAdminEmail(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/staff-portal?denied=permission');
  return data.user.email ?? 'Admin';
}

export async function confirmTicketSentAction(formData: FormData) {
  const confirmedBy = await requireAdminEmail();
  const jobId = String(formData.get('jobId') ?? '');
  const interestId = String(formData.get('interestId') ?? '');
  if (!jobId || !interestId) return;
  const result = await confirmStylistTicketSent(jobId, interestId, confirmedBy);
  if (result.error) redirect(`/travel/${jobId}/${interestId}?error=${encodeURIComponent(result.error)}`);
  revalidatePath('/travel');
  revalidatePath(`/travel/${jobId}/${interestId}`);
  revalidatePath('/staff-portal/notifications');
  revalidatePath('/staff-portal/stylist/assigned');
  redirect(`/travel/${jobId}/${interestId}?confirmed=1`);
}

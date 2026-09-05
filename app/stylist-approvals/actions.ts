'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { decideStylistInterest, setStylistsRequiredCount } from '@/lib/event-jobs/store';
import type { StylistInterestStatus } from '@/lib/event-jobs/types';
import { createClient } from '@/lib/supabase/server';

async function requireAdminEmail(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  return data.user.email ?? 'Admin';
}

const DECISIONS: StylistInterestStatus[] = ['approved', 'rejected', 'backup'];

export async function decideInterestAction(formData: FormData) {
  const decidedBy = await requireAdminEmail();
  const jobId = String(formData.get('jobId') ?? '');
  const interestId = String(formData.get('interestId') ?? '');
  const decisionRaw = String(formData.get('decision') ?? '');
  if (!jobId || !interestId || !DECISIONS.includes(decisionRaw as StylistInterestStatus)) return;
  await decideStylistInterest(jobId, interestId, decisionRaw as StylistInterestStatus, decidedBy);
  revalidatePath('/stylist-approvals');
  revalidatePath(`/event-jobs/${jobId}`);
}

export async function setStylistsRequiredAction(formData: FormData) {
  await requireAdminEmail();
  const jobId = String(formData.get('jobId') ?? '');
  const countRaw = String(formData.get('count') ?? '');
  const count = Number(countRaw);
  if (!jobId || Number.isNaN(count) || count < 0) return;
  await setStylistsRequiredCount(jobId, count);
  revalidatePath('/stylist-approvals');
  revalidatePath(`/event-jobs/${jobId}`);
}

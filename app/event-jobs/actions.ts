'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addIssue, resolveIssue } from '@/lib/event-jobs/store';
import type { EventJobStageKey } from '@/lib/event-jobs/constants';
import { createClient } from '@/lib/supabase/server';

async function requireAdminEmail(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/staff-portal?denied=permission');
  return data.user.email ?? 'Admin';
}

export async function addIssueAction(formData: FormData) {
  const raisedBy = await requireAdminEmail();
  const jobId = String(formData.get('jobId') ?? '');
  const description = String(formData.get('description') ?? '').trim();
  const stageRaw = String(formData.get('stage') ?? '');
  if (!jobId || !description) return;
  await addIssue(jobId, description, raisedBy, stageRaw ? (stageRaw as EventJobStageKey) : null);
  revalidatePath(`/event-jobs/${jobId}`);
}

export async function resolveIssueAction(formData: FormData) {
  const resolvedBy = await requireAdminEmail();
  const jobId = String(formData.get('jobId') ?? '');
  const issueId = String(formData.get('issueId') ?? '');
  if (!jobId || !issueId) return;
  await resolveIssue(jobId, issueId, resolvedBy);
  revalidatePath(`/event-jobs/${jobId}`);
}
